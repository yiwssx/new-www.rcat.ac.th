import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import process from "node:process";
import {
  clearCmsAuthCookies,
  createCmsAuthCookies,
  isValidCmsCookieToken,
  readCmsCsrfCookie,
  readCmsSessionCookie
} from "./cookies.mjs";

export const CMS_AUTH_PROXY_SECRET_HEADER = "X-RCAT-CMS-Auth-Proxy-Secret";
export const CMS_SESSION_TOKEN_HEADER = "X-RCAT-CMS-Session-Token";
export const CMS_CSRF_TOKEN_HEADER = "X-RCAT-CMS-CSRF-Token";
export const CMS_CLIENT_IP_HEADER = "X-RCAT-CMS-Client-IP";
export const CMS_USER_AGENT_HEADER = "X-RCAT-CMS-User-Agent";
export const CMS_NEW_SESSION_TOKEN_HEADER = "X-RCAT-CMS-New-Session-Token";
export const CMS_NEW_CSRF_TOKEN_HEADER = "X-RCAT-CMS-New-CSRF-Token";
export const CMS_BROWSER_CSRF_HEADER = "X-RCAT-CSRF-Token";

const LOGIN_PATH = "/api/internal/cms-auth/login";
const SESSION_PATH = "/api/internal/cms-auth/session";
const LOGOUT_PATH = "/api/internal/cms-auth/logout";
const LOGOUT_ALL_PATH = "/api/internal/cms-auth/logout-all";
const MAX_LOGIN_BODY_BYTES = 16 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IDENTIFIER = 5;
const MAX_FAILURES_PER_IP = 20;
const MAX_RATE_LIMIT_BUCKETS = 5000;
const defaultLoginLimiter = createCmsLoginRateLimiter();

function runtimeEnv() {
  return process.env;
}

export function getRequestHeader(request, name) {
  if (typeof request.headers?.get === "function") {
    return request.headers.get(name) ?? "";
  }

  const value = request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? "") : typeof value === "string" ? value : "";
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendEmpty(response, status) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

function sendMethodNotAllowed(response, allowedMethods) {
  response.setHeader("Allow", allowedMethods.join(", "));
  sendJson(response, 405, { error: "method not allowed" });
}

export function getCmsRequestOriginStatus(request) {
  const origin = getRequestHeader(request, "origin");

  if (!origin) {
    return "allowed";
  }

  const host = getRequestHeader(request, "x-forwarded-host") || getRequestHeader(request, "host");
  const forwardedProtocol = getRequestHeader(request, "x-forwarded-proto");

  try {
    const parsedOrigin = new URL(origin);

    if (!host || parsedOrigin.host.toLowerCase() !== host.toLowerCase()) {
      return "blocked";
    }

    if (forwardedProtocol && parsedOrigin.protocol !== `${forwardedProtocol.toLowerCase()}:`) {
      return "blocked";
    }

    return "allowed";
  } catch {
    return "blocked";
  }
}

async function readRequestBody(request, maximumBytes) {
  if (request.body !== undefined) {
    if (Buffer.isBuffer(request.body)) {
      if (request.body.length > maximumBytes) {
        throw new RangeError("request body is too large");
      }

      return request.body;
    }

    if (typeof request.body === "string") {
      const body = Buffer.from(request.body);

      if (body.length > maximumBytes) {
        throw new RangeError("request body is too large");
      }

      return body;
    }

    const body = Buffer.from(JSON.stringify(request.body));

    if (body.length > maximumBytes) {
      throw new RangeError("request body is too large");
    }

    return body;
  }

  const chunks = [];
  let length = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;

    if (length > maximumBytes) {
      throw new RangeError("request body is too large");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody(request) {
  const body = await readRequestBody(request, MAX_LOGIN_BODY_BYTES);

  if (body.length === 0) {
    throw new SyntaxError("request body is required");
  }

  const parsed = JSON.parse(body.toString("utf8"));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("request body must be a JSON object");
  }

  return parsed;
}

export function normalizeCmsLoginIdentifier(value) {
  const identifier = typeof value === "string" ? value.trim().toLowerCase() : "";
  return identifier.length > 0 && identifier.length <= 320 ? identifier : "";
}

function containsControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
}

function readClientIp(request) {
  for (const headerName of ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"]) {
    const value = getRequestHeader(request, headerName);

    if (!value) {
      continue;
    }

    const candidate = value.split(",", 1)[0].trim();

    if (candidate.length > 0 && candidate.length <= 64 && !containsControlCharacter(candidate) && isIP(candidate) > 0) {
      return candidate.toLowerCase();
    }

    return "unknown";
  }

  return "unknown";
}

export function getCmsClientMetadata(request) {
  const userAgent = getRequestHeader(request, "user-agent");

  return {
    clientIp: readClientIp(request),
    userAgent:
      userAgent.length > 0 && userAgent.length <= 512 && !containsControlCharacter(userAgent) ? userAgent : "unknown"
  };
}

export function readCmsAuthConfiguration(env) {
  if (env.CMS_AUTH_ENABLED !== "true") {
    return null;
  }

  const proxySecret = typeof env.CMS_AUTH_PROXY_SECRET === "string" ? env.CMS_AUTH_PROXY_SECRET : "";
  const workerUrlValue = typeof env.CLOUDFLARE_ADMIN_API_URL === "string" ? env.CLOUDFLARE_ADMIN_API_URL.trim() : "";
  let workerUrl;

  try {
    workerUrl = new URL(workerUrlValue);
  } catch {
    return null;
  }

  if (
    proxySecret.length < 32 ||
    workerUrl.protocol !== "https:" ||
    workerUrl.username ||
    workerUrl.password ||
    workerUrl.search ||
    workerUrl.hash ||
    (workerUrl.pathname !== "/" && workerUrl.pathname !== "")
  ) {
    return null;
  }

  return { proxySecret, workerOrigin: workerUrl.origin };
}

export function cmsTokensMatch(actual, expected) {
  if (!isValidCmsCookieToken(actual) || !isValidCmsCookieToken(expected)) {
    return false;
  }

  const actualBytes = Buffer.from(actual, "ascii");
  const expectedBytes = Buffer.from(expected, "ascii");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function rateLimitKey(secret, value) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function createCmsLoginRateLimitKeys({ identifier, clientIp, secret }) {
  return {
    identifierKey: identifier ? rateLimitKey(secret, `cms-identifier:${identifier}|${clientIp}`) : null,
    ipKey: rateLimitKey(secret, `cms-ip:${clientIp}`)
  };
}

export function createCmsLoginRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? LOGIN_WINDOW_MS;
  const blockMs = options.blockMs ?? LOGIN_BLOCK_MS;
  const identifierLimit = options.identifierLimit ?? MAX_FAILURES_PER_IDENTIFIER;
  const ipLimit = options.ipLimit ?? MAX_FAILURES_PER_IP;
  const maximumBuckets = options.maximumBuckets ?? MAX_RATE_LIMIT_BUCKETS;
  const buckets = new Map();

  function entries(keys) {
    return keys.identifierKey
      ? [
          [keys.ipKey, ipLimit],
          [keys.identifierKey, identifierLimit]
        ]
      : [[keys.ipKey, ipLimit]];
  }

  function prune(nowMs) {
    for (const [key, bucket] of buckets) {
      const expiresAt = bucket.blockedUntil || bucket.windowStartedAt + windowMs;

      if (expiresAt <= nowMs) {
        buckets.delete(key);
      }
    }
  }

  function ensureCapacity(nowMs) {
    prune(nowMs);

    while (buckets.size >= maximumBuckets) {
      let oldestKey;
      let oldestTouchedAt = Number.POSITIVE_INFINITY;

      for (const [key, bucket] of buckets) {
        if (bucket.lastTouchedAt < oldestTouchedAt) {
          oldestKey = key;
          oldestTouchedAt = bucket.lastTouchedAt;
        }
      }

      if (oldestKey === undefined) {
        break;
      }

      buckets.delete(oldestKey);
    }
  }

  function check(keys, nowMs) {
    prune(nowMs);
    let retryAfterMs = 0;

    for (const [key] of entries(keys)) {
      const bucket = buckets.get(key);

      if (bucket) {
        bucket.lastTouchedAt = nowMs;
        retryAfterMs = Math.max(retryAfterMs, bucket.blockedUntil - nowMs);
      }
    }

    return {
      blocked: retryAfterMs > 0,
      retryAfterSeconds: retryAfterMs > 0 ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0
    };
  }

  function recordFailure(keys, nowMs) {
    const existing = check(keys, nowMs);

    if (existing.blocked) {
      return existing;
    }

    for (const [key, limit] of entries(keys)) {
      let bucket = buckets.get(key);

      if (!bucket) {
        ensureCapacity(nowMs);
        bucket = { failures: 0, blockedUntil: 0, windowStartedAt: nowMs, lastTouchedAt: nowMs };
        buckets.set(key, bucket);
      }

      bucket.failures += 1;
      bucket.lastTouchedAt = nowMs;

      if (bucket.failures >= limit) {
        bucket.blockedUntil = nowMs + blockMs;
      }
    }

    return check(keys, nowMs);
  }

  function recordSuccess(keys, nowMs) {
    prune(nowMs);

    if (keys.identifierKey) {
      buckets.delete(keys.identifierKey);
    }
  }

  return { check, recordFailure, recordSuccess };
}

function sendRateLimitError(response, result) {
  response.setHeader("Retry-After", String(result.retryAfterSeconds));
  sendJson(response, 429, { error: "too many login attempts", retryAfterSeconds: result.retryAfterSeconds });
}

function createPrivateHeaders(configuration, metadata, additional = {}) {
  const headers = new Headers({
    Accept: "application/json",
    [CMS_AUTH_PROXY_SECRET_HEADER]: configuration.proxySecret,
    [CMS_CLIENT_IP_HEADER]: metadata.clientIp,
    [CMS_USER_AGENT_HEADER]: metadata.userAgent,
    ...additional
  });
  return headers;
}

function readSafeUserPayload(value) {
  const user = value && typeof value === "object" && !Array.isArray(value) ? value.user : null;

  if (!user || typeof user !== "object" || Array.isArray(user)) {
    return null;
  }

  if (
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.name !== "string" ||
    !(typeof user.username === "string" || user.username === null) ||
    !["admin", "editor", "viewer"].includes(user.role) ||
    typeof user.isRoot !== "boolean" ||
    typeof user.sessionId !== "string" ||
    !Number.isInteger(user.sessionVersion) ||
    user.sessionVersion < 1
  ) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    isRoot: user.isRoot,
    sessionId: user.sessionId,
    sessionVersion: user.sessionVersion
  };
}

async function readUpstreamSafeUser(response) {
  try {
    return readSafeUserPayload(await response.json());
  } catch {
    return null;
  }
}

function sendGenericUpstreamError(response, upstreamResponse, login = false) {
  if (login && upstreamResponse.status === 401) {
    sendJson(response, 401, { error: "invalid identifier or password" });
    return;
  }

  if (upstreamResponse.status === 401) {
    sendJson(response, 401, { error: "CMS session is invalid or expired" });
    return;
  }

  if (upstreamResponse.status === 403) {
    sendJson(response, 403, { error: "CMS request is forbidden" });
    return;
  }

  sendJson(response, upstreamResponse.status === 429 ? 429 : 503, { error: "CMS authentication is unavailable" });
}

export async function handleCmsAuthLogin(request, response, options = {}) {
  if (String(request.method || "GET").toUpperCase() !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  if (getCmsRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "CMS authentication origin is not allowed" });
    return;
  }

  const env = options.env ?? runtimeEnv();
  const configuration = readCmsAuthConfiguration(env);

  if (!configuration) {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return;
  }

  const metadata = getCmsClientMetadata(request);
  const loginLimiter = options.loginLimiter ?? defaultLoginLimiter;
  const nowMs = options.nowMs ?? Date.now();
  const ipOnlyKeys = createCmsLoginRateLimitKeys({
    identifier: "",
    clientIp: metadata.clientIp,
    secret: configuration.proxySecret
  });
  const ipStatus = loginLimiter.check(ipOnlyKeys, nowMs);

  if (ipStatus.blocked) {
    sendRateLimitError(response, ipStatus);
    return;
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    const result = loginLimiter.recordFailure(ipOnlyKeys, nowMs);

    if (result.blocked) {
      sendRateLimitError(response, result);
      return;
    }

    sendJson(response, error instanceof RangeError ? 413 : 400, { error: "invalid login request" });
    return;
  }

  const identifier = normalizeCmsLoginIdentifier(body.identifier);
  const password = typeof body.password === "string" ? body.password : "";
  const keys = createCmsLoginRateLimitKeys({
    identifier,
    clientIp: metadata.clientIp,
    secret: configuration.proxySecret
  });
  const status = loginLimiter.check(keys, nowMs);

  if (status.blocked) {
    sendRateLimitError(response, status);
    return;
  }

  if (!identifier || !password) {
    const result = loginLimiter.recordFailure(keys, nowMs);

    if (result.blocked) {
      sendRateLimitError(response, result);
      return;
    }

    sendJson(response, 401, { error: "invalid identifier or password" });
    return;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let upstreamResponse;

  try {
    upstreamResponse = await fetchImpl(`${configuration.workerOrigin}${LOGIN_PATH}`, {
      method: "POST",
      headers: createPrivateHeaders(configuration, metadata, { "Content-Type": "application/json" }),
      body: JSON.stringify({ identifier, password }),
      redirect: "error"
    });
  } catch {
    sendJson(response, 502, { error: "CMS authentication upstream request failed" });
    return;
  }

  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 401) {
      const result = loginLimiter.recordFailure(keys, nowMs);

      if (result.blocked) {
        sendRateLimitError(response, result);
        return;
      }
    }

    sendGenericUpstreamError(response, upstreamResponse, true);
    return;
  }

  const sessionToken = upstreamResponse.headers.get(CMS_NEW_SESSION_TOKEN_HEADER) ?? "";
  const csrfToken = upstreamResponse.headers.get(CMS_NEW_CSRF_TOKEN_HEADER) ?? "";
  const user = await readUpstreamSafeUser(upstreamResponse);

  if (!isValidCmsCookieToken(sessionToken) || !isValidCmsCookieToken(csrfToken) || !user) {
    sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
    return;
  }

  loginLimiter.recordSuccess(keys, nowMs);
  response.setHeader("Set-Cookie", createCmsAuthCookies(sessionToken, csrfToken));
  sendJson(response, 200, { ok: true, user });
}

export async function handleCmsAuthSession(request, response, options = {}) {
  if (String(request.method || "GET").toUpperCase() !== "GET") {
    sendMethodNotAllowed(response, ["GET"]);
    return;
  }

  if (getCmsRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "CMS authentication origin is not allowed" });
    return;
  }

  const env = options.env ?? runtimeEnv();
  const configuration = readCmsAuthConfiguration(env);

  if (!configuration) {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return;
  }

  const sessionToken = readCmsSessionCookie(getRequestHeader(request, "cookie"));

  if (!sessionToken) {
    sendJson(response, 401, { error: "CMS session is invalid or expired" });
    return;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let upstreamResponse;

  try {
    upstreamResponse = await fetchImpl(`${configuration.workerOrigin}${SESSION_PATH}`, {
      method: "GET",
      headers: createPrivateHeaders(configuration, getCmsClientMetadata(request), {
        [CMS_SESSION_TOKEN_HEADER]: sessionToken
      }),
      redirect: "error"
    });
  } catch {
    sendJson(response, 502, { error: "CMS authentication upstream request failed" });
    return;
  }

  if (!upstreamResponse.ok) {
    sendGenericUpstreamError(response, upstreamResponse);
    return;
  }

  const user = await readUpstreamSafeUser(upstreamResponse);

  if (!user) {
    sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
    return;
  }

  sendJson(response, 200, { ok: true, user });
}

async function handleCmsLogoutOperation(request, response, options, logoutAll) {
  if (String(request.method || "GET").toUpperCase() !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  if (getCmsRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "CMS authentication origin is not allowed" });
    return;
  }

  if (!logoutAll) {
    response.setHeader("Set-Cookie", clearCmsAuthCookies());
  }

  const env = options.env ?? runtimeEnv();
  const configuration = readCmsAuthConfiguration(env);

  if (!configuration) {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return;
  }

  const cookieHeader = getRequestHeader(request, "cookie");
  const sessionToken = readCmsSessionCookie(cookieHeader);
  const csrfCookie = readCmsCsrfCookie(cookieHeader);
  const csrfHeader = getRequestHeader(request, CMS_BROWSER_CSRF_HEADER);

  if (!sessionToken) {
    sendJson(response, 401, { error: "CMS session is invalid or expired" });
    return;
  }

  if (!cmsTokensMatch(csrfCookie, csrfHeader)) {
    sendJson(response, 403, { error: "CSRF validation failed" });
    return;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let upstreamResponse;

  try {
    upstreamResponse = await fetchImpl(`${configuration.workerOrigin}${logoutAll ? LOGOUT_ALL_PATH : LOGOUT_PATH}`, {
      method: "POST",
      headers: createPrivateHeaders(configuration, getCmsClientMetadata(request), {
        [CMS_SESSION_TOKEN_HEADER]: sessionToken,
        [CMS_CSRF_TOKEN_HEADER]: csrfHeader
      }),
      redirect: "error"
    });
  } catch {
    sendJson(response, 502, { error: "CMS authentication upstream request failed" });
    return;
  }

  if (!upstreamResponse.ok) {
    sendGenericUpstreamError(response, upstreamResponse);
    return;
  }

  response.setHeader("Set-Cookie", clearCmsAuthCookies());
  sendEmpty(response, 204);
}

export function handleCmsAuthLogout(request, response, options = {}) {
  return handleCmsLogoutOperation(request, response, options, false);
}

export function handleCmsAuthLogoutAll(request, response, options = {}) {
  return handleCmsLogoutOperation(request, response, options, true);
}
