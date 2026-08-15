import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import process from "node:process";
import {
  clearCmsAuthCookies,
  clearCmsAuthenticationStateCookies,
  clearCmsMfaChallengeCookie,
  createCmsAuthCookies,
  createCmsMfaChallengeCookie,
  hasCmsMfaChallengeCookie,
  isValidCmsCookieToken,
  readCmsCsrfCookie,
  readCmsSessionCookie,
  readCmsMfaChallengeCookie
} from "./cookies.mjs";
import {
  MAX_RATE_LIMIT_BUCKETS,
  createCmsLifecycleRateLimitKeys,
  createCmsLifecycleRateLimiter,
  createCmsLoginRateLimitKeys,
  createCmsLoginRateLimiter
} from "./rateLimiters.mjs";
export { createCmsLifecycleRateLimiter, createCmsLoginRateLimiter };

export const CMS_AUTH_PROXY_SECRET_HEADER = "X-RCAT-CMS-Auth-Proxy-Secret";
export const CMS_SESSION_TOKEN_HEADER = "X-RCAT-CMS-Session-Token";
export const CMS_CSRF_TOKEN_HEADER = "X-RCAT-CMS-CSRF-Token";
export const CMS_CLIENT_IP_HEADER = "X-RCAT-CMS-Client-IP";
export const CMS_USER_AGENT_HEADER = "X-RCAT-CMS-User-Agent";
export const CMS_NEW_SESSION_TOKEN_HEADER = "X-RCAT-CMS-New-Session-Token";
export const CMS_NEW_CSRF_TOKEN_HEADER = "X-RCAT-CMS-New-CSRF-Token";
export const CMS_BROWSER_CSRF_HEADER = "X-RCAT-CSRF-Token";
export const CMS_MFA_CHALLENGE_TOKEN_HEADER = "X-RCAT-CMS-MFA-Challenge-Token";
export const CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER = "X-RCAT-CMS-New-MFA-Challenge-Token";

const LOGIN_PATH = "/api/internal/cms-auth/login";
const SESSION_PATH = "/api/internal/cms-auth/session";
const LOGOUT_PATH = "/api/internal/cms-auth/logout";
const LOGOUT_ALL_PATH = "/api/internal/cms-auth/logout-all";
const INVITATION_INSPECT_PATH = "/api/internal/cms-auth/invitation/inspect";
const INVITATION_ACCEPT_PATH = "/api/internal/cms-auth/invitation/accept";
const PASSWORD_RESET_INSPECT_PATH = "/api/internal/cms-auth/password-reset/inspect";
const PASSWORD_RESET_COMPLETE_PATH = "/api/internal/cms-auth/password-reset/complete";
const CHANGE_PASSWORD_PATH = "/api/internal/cms-auth/change-password";
const MFA_VERIFY_PATH = "/api/internal/cms-auth/mfa/verify";
const MFA_SETUP_START_PATH = "/api/internal/cms-auth/mfa/setup/start";
const MFA_SETUP_CONFIRM_PATH = "/api/internal/cms-auth/mfa/setup/confirm";
const MFA_RECOVERY_REGENERATE_PATH = "/api/internal/cms-auth/mfa/recovery-codes/regenerate";
const MFA_DISABLE_PATH = "/api/internal/cms-auth/mfa";
const REAUTHENTICATE_PATH = "/api/internal/cms-auth/reauthenticate";
const MAX_LOGIN_BODY_BYTES = 16 * 1024;
const RECENT_AUTHENTICATION_WINDOW_MS = 10 * 60 * 1000;
const defaultLoginLimiter = createCmsLoginRateLimiter();
const defaultLifecycleLimiter = createCmsLifecycleRateLimiter();
const defaultPasswordChangeLimiter = createCmsLoginRateLimiter({
  identifierLimit: 5,
  ipLimit: 20,
  maximumBuckets: MAX_RATE_LIMIT_BUCKETS
});

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

function isCanonicalTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isRecentAuthentication(value, nowMs) {
  if (!isCanonicalTimestamp(value) || !Number.isFinite(nowMs)) return false;
  const age = nowMs - Date.parse(value);
  return age >= 0 && age < RECENT_AUTHENTICATION_WINDOW_MS;
}

function readSafeUserPayload(value, nowMs = Date.now()) {
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
    user.sessionVersion < 1 ||
    typeof user.reauthenticatedAt !== "string" ||
    typeof user.mfaVerifiedAt !== "string"
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
    recentPasswordAuthentication: isRecentAuthentication(user.reauthenticatedAt, nowMs),
    recentMfaAuthentication: isRecentAuthentication(user.mfaVerifiedAt, nowMs)
  };
}

async function readUpstreamSafeUser(response, nowMs = Date.now()) {
  try {
    return readSafeUserPayload(await response.json(), nowMs);
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

  if (upstreamResponse.status === 202) {
    const challengeToken = upstreamResponse.headers.get(CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER) ?? "";
    const upstreamBody = await readUpstreamJson(upstreamResponse);

    if (
      !isValidCmsCookieToken(challengeToken) ||
      upstreamBody?.mfaRequired !== true ||
      typeof upstreamBody.enrollmentRequired !== "boolean"
    ) {
      sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
      return;
    }

    loginLimiter.recordSuccess(keys, nowMs);
    response.setHeader("Set-Cookie", [
      ...clearCmsAuthCookies(),
      createCmsMfaChallengeCookie(challengeToken, upstreamBody.enrollmentRequired ? 10 * 60 : 5 * 60)
    ]);
    sendJson(response, 202, {
      mfaRequired: true,
      enrollmentRequired: upstreamBody.enrollmentRequired
    });
    return;
  }

  const sessionToken = upstreamResponse.headers.get(CMS_NEW_SESSION_TOKEN_HEADER) ?? "";
  const csrfToken = upstreamResponse.headers.get(CMS_NEW_CSRF_TOKEN_HEADER) ?? "";
  const assuranceNowMs = typeof options.assuranceNowMs === "number" ? options.assuranceNowMs : Date.now();
  const user = await readUpstreamSafeUser(upstreamResponse, assuranceNowMs);

  if (!isValidCmsCookieToken(sessionToken) || !isValidCmsCookieToken(csrfToken) || !user) {
    sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
    return;
  }

  loginLimiter.recordSuccess(keys, nowMs);
  response.setHeader("Set-Cookie", [...createCmsAuthCookies(sessionToken, csrfToken), clearCmsMfaChallengeCookie()]);
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

  const user = await readUpstreamSafeUser(upstreamResponse, options.nowMs ?? Date.now());

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

  response.setHeader("Set-Cookie", clearCmsAuthenticationStateCookies());

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

  response.setHeader("Set-Cookie", clearCmsAuthenticationStateCookies());
  sendEmpty(response, 204);
}

export function handleCmsAuthLogout(request, response, options = {}) {
  return handleCmsLogoutOperation(request, response, options, false);
}

export function handleCmsAuthLogoutAll(request, response, options = {}) {
  return handleCmsLogoutOperation(request, response, options, true);
}

function requestHasQueryString(request) {
  try {
    return new URL(String(request.url || ""), "https://cms.invalid").search.length > 0;
  } catch {
    return true;
  }
}

async function readUpstreamJson(response) {
  try {
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function sendLifecycleRateLimitError(response, result) {
  response.setHeader("Retry-After", String(result.retryAfterSeconds));
  sendJson(response, 429, {
    error: "too many lifecycle attempts",
    retryAfterSeconds: result.retryAfterSeconds
  });
}

function lifecycleInvalidMessage(kind) {
  return kind.startsWith("invitation")
    ? "invitation is invalid or expired"
    : "password-reset link is invalid or expired";
}

function lifecycleRoute(kind) {
  return {
    "invitation-inspect": INVITATION_INSPECT_PATH,
    "invitation-accept": INVITATION_ACCEPT_PATH,
    "password-reset-inspect": PASSWORD_RESET_INSPECT_PATH,
    "password-reset-complete": PASSWORD_RESET_COMPLETE_PATH
  }[kind];
}

function readLifecycleForwardBody(kind, body) {
  if (typeof body.token !== "string") return null;

  if (kind.endsWith("inspect")) {
    return { token: body.token };
  }

  if (typeof body.password !== "string" || typeof body.passwordConfirmation !== "string") {
    return null;
  }

  const forwarded = {
    token: body.token,
    password: body.password,
    passwordConfirmation: body.passwordConfirmation
  };

  if (kind === "invitation-accept" && Object.prototype.hasOwnProperty.call(body, "username")) {
    forwarded.username = body.username;
  }

  return forwarded;
}

function isSafeLifecycleError(kind, message) {
  const shared = new Set([
    lifecycleInvalidMessage(kind),
    "password and password confirmation are required",
    "password confirmation does not match",
    "password policy validation failed",
    "username is invalid",
    "username is already in use",
    "preassigned username cannot be replaced"
  ]);
  return shared.has(message);
}

async function handleCmsLifecycleRequest(request, response, kind, options = {}) {
  if (String(request.method || "GET").toUpperCase() !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  if (getCmsRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "CMS authentication origin is not allowed" });
    return;
  }

  if (requestHasQueryString(request)) {
    sendJson(response, 400, { error: lifecycleInvalidMessage(kind) });
    return;
  }

  const env = options.env ?? runtimeEnv();
  const configuration = readCmsAuthConfiguration(env);

  if (!configuration) {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return;
  }

  const metadata = getCmsClientMetadata(request);
  const completion = kind.endsWith("accept") || kind.endsWith("complete");
  const limiter = options.lifecycleLimiter ?? defaultLifecycleLimiter;
  const nowMs = options.nowMs ?? Date.now();
  const keys = createCmsLifecycleRateLimitKeys({
    clientIp: metadata.clientIp,
    secret: configuration.proxySecret,
    withFailure: completion
  });
  let rateStatus = limiter.check(keys, nowMs);

  if (rateStatus.blocked) {
    sendLifecycleRateLimitError(response, rateStatus);
    return;
  }

  rateStatus = limiter.recordAttempt(keys, nowMs);

  if (rateStatus.blocked) {
    sendLifecycleRateLimitError(response, rateStatus);
    return;
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (completion) limiter.recordFailure(keys, nowMs);
    sendJson(response, error instanceof RangeError ? 413 : 400, { error: lifecycleInvalidMessage(kind) });
    return;
  }

  const forwardedBody = readLifecycleForwardBody(kind, body);

  if (!forwardedBody) {
    if (completion) limiter.recordFailure(keys, nowMs);
    sendJson(response, 400, { error: lifecycleInvalidMessage(kind) });
    return;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let upstreamResponse;

  try {
    upstreamResponse = await fetchImpl(`${configuration.workerOrigin}${lifecycleRoute(kind)}`, {
      method: "POST",
      headers: createPrivateHeaders(configuration, metadata, { "Content-Type": "application/json" }),
      body: JSON.stringify(forwardedBody),
      redirect: "error"
    });
  } catch {
    sendJson(response, 502, { error: "CMS authentication upstream request failed" });
    return;
  }

  const upstreamBody = await readUpstreamJson(upstreamResponse);

  if (!upstreamResponse.ok) {
    if (completion) {
      const failure = limiter.recordFailure(keys, nowMs);

      if (failure.blocked) {
        sendLifecycleRateLimitError(response, failure);
        return;
      }
    }

    const message = typeof upstreamBody?.error === "string" ? upstreamBody.error : "";

    if (isSafeLifecycleError(kind, message)) {
      const payload = { error: message };

      if (typeof upstreamBody.code === "string") payload.code = upstreamBody.code;
      sendJson(response, upstreamResponse.status === 409 ? 409 : 400, payload);
      return;
    }

    sendJson(response, upstreamResponse.status === 429 ? 429 : 503, {
      error: upstreamResponse.status === 429 ? "too many lifecycle attempts" : "CMS authentication is unavailable"
    });
    return;
  }

  if (kind === "invitation-inspect") {
    const user = upstreamBody?.user;

    if (
      upstreamBody?.valid !== true ||
      !user ||
      typeof user.email !== "string" ||
      typeof user.name !== "string" ||
      !["admin", "editor", "viewer"].includes(user.role) ||
      !(typeof user.username === "string" || user.username === null) ||
      typeof upstreamBody.expiresAt !== "string"
    ) {
      sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
      return;
    }

    sendJson(response, 200, {
      valid: true,
      user: { email: user.email, name: user.name, role: user.role, username: user.username },
      expiresAt: upstreamBody.expiresAt
    });
    return;
  }

  if (kind === "password-reset-inspect") {
    if (
      upstreamBody?.valid !== true ||
      typeof upstreamBody.user?.emailHint !== "string" ||
      typeof upstreamBody.expiresAt !== "string"
    ) {
      sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
      return;
    }

    sendJson(response, 200, {
      valid: true,
      user: { emailHint: upstreamBody.user.emailHint },
      expiresAt: upstreamBody.expiresAt
    });
    return;
  }

  if (kind === "invitation-accept" && upstreamBody?.ok === true && upstreamBody.credentialConfigured === true) {
    sendJson(response, 200, { ok: true, credentialConfigured: true });
    return;
  }

  if (kind === "password-reset-complete" && upstreamBody?.ok === true && upstreamBody.passwordReset === true) {
    sendJson(response, 200, { ok: true, passwordReset: true });
    return;
  }

  sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
}

export function handleCmsInvitationInspect(request, response, options = {}) {
  return handleCmsLifecycleRequest(request, response, "invitation-inspect", options);
}

export function handleCmsInvitationAccept(request, response, options = {}) {
  return handleCmsLifecycleRequest(request, response, "invitation-accept", options);
}

export function handleCmsPasswordResetInspect(request, response, options = {}) {
  return handleCmsLifecycleRequest(request, response, "password-reset-inspect", options);
}

export function handleCmsPasswordResetComplete(request, response, options = {}) {
  return handleCmsLifecycleRequest(request, response, "password-reset-complete", options);
}

export async function handleCmsPasswordChange(request, response, options = {}) {
  if (String(request.method || "GET").toUpperCase() !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  if (getCmsRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "CMS authentication origin is not allowed" });
    return;
  }

  if (requestHasQueryString(request)) {
    sendJson(response, 400, { error: "invalid password-change request" });
    return;
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

  const metadata = getCmsClientMetadata(request);
  const limiter = options.passwordChangeLimiter ?? defaultPasswordChangeLimiter;
  const nowMs = options.nowMs ?? Date.now();
  const keys = createCmsLoginRateLimitKeys({
    identifier: sessionToken,
    clientIp: metadata.clientIp,
    secret: configuration.proxySecret
  });
  const rateStatus = limiter.check(keys, nowMs);

  if (rateStatus.blocked) {
    sendRateLimitError(response, rateStatus);
    return;
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    sendJson(response, error instanceof RangeError ? 413 : 400, { error: "invalid password-change request" });
    return;
  }

  if (
    typeof body.currentPassword !== "string" ||
    typeof body.password !== "string" ||
    typeof body.passwordConfirmation !== "string"
  ) {
    sendJson(response, 400, { error: "invalid password-change request" });
    return;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let upstreamResponse;

  try {
    upstreamResponse = await fetchImpl(`${configuration.workerOrigin}${CHANGE_PASSWORD_PATH}`, {
      method: "POST",
      headers: createPrivateHeaders(configuration, metadata, {
        "Content-Type": "application/json",
        [CMS_SESSION_TOKEN_HEADER]: sessionToken,
        [CMS_CSRF_TOKEN_HEADER]: csrfHeader
      }),
      body: JSON.stringify({
        currentPassword: body.currentPassword,
        password: body.password,
        passwordConfirmation: body.passwordConfirmation
      }),
      redirect: "error"
    });
  } catch {
    sendJson(response, 502, { error: "CMS authentication upstream request failed" });
    return;
  }

  const upstreamBody = await readUpstreamJson(upstreamResponse);

  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 401 && upstreamBody?.error === "current password is invalid") {
      const failure = limiter.recordFailure(keys, nowMs);

      if (failure.blocked) {
        sendRateLimitError(response, failure);
        return;
      }

      sendJson(response, 401, { error: "current password is invalid" });
      return;
    }

    const safeErrors = new Set([
      "current password is required",
      "password and password confirmation are required",
      "password confirmation does not match",
      "password policy validation failed",
      "new password must differ from current password"
    ]);
    const message = typeof upstreamBody?.error === "string" ? upstreamBody.error : "";

    if (safeErrors.has(message)) {
      const payload = { error: message };

      if (typeof upstreamBody.code === "string") payload.code = upstreamBody.code;
      sendJson(response, 400, payload);
      return;
    }

    sendGenericUpstreamError(response, upstreamResponse);
    return;
  }

  if (upstreamBody?.ok !== true || upstreamBody.passwordChanged !== true) {
    sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
    return;
  }

  limiter.recordSuccess(keys, nowMs);
  response.setHeader("Set-Cookie", clearCmsAuthenticationStateCookies());
  sendJson(response, 200, { ok: true, passwordChanged: true });
}

const defaultMfaLimiter = createCmsLoginRateLimiter({
  identifierLimit: 5,
  ipLimit: 20,
  maximumBuckets: MAX_RATE_LIMIT_BUCKETS
});

function readSessionProxyCredentials(request) {
  const cookieHeader = getRequestHeader(request, "cookie");
  return {
    sessionToken: readCmsSessionCookie(cookieHeader),
    csrfToken: readCmsCsrfCookie(cookieHeader),
    browserCsrfToken: getRequestHeader(request, CMS_BROWSER_CSRF_HEADER)
  };
}

function readMfaChallengeProxyCredential(request) {
  const cookieHeader = getRequestHeader(request, "cookie");
  return {
    present: hasCmsMfaChallengeCookie(cookieHeader),
    token: readCmsMfaChallengeCookie(cookieHeader)
  };
}

function sendMfaProxyUpstreamError(response, upstreamResponse, upstreamBody, definition) {
  const upstreamMessage = typeof upstreamBody?.error === "string" ? upstreamBody.error : "";

  if (upstreamResponse.status === 401) {
    const error =
      upstreamMessage === "CMS session is invalid or expired"
        ? "CMS session is invalid or expired"
        : definition.authenticationFailure || "CMS session is invalid or expired";
    sendJson(response, 401, { error });
    return;
  }

  if (upstreamResponse.status === 428) {
    sendJson(response, 428, { error: "reauthentication required" });
    return;
  }

  if (
    upstreamResponse.status === 409 &&
    Array.isArray(definition.conflictErrors) &&
    definition.conflictErrors.includes(upstreamMessage)
  ) {
    sendJson(response, 409, { error: upstreamMessage });
    return;
  }

  if (upstreamResponse.status === 400 && upstreamMessage === "invalid MFA request") {
    sendJson(response, 400, { error: "invalid MFA request" });
    return;
  }

  sendGenericUpstreamError(response, upstreamResponse);
}

async function handleCmsMfaProxy(request, response, definition, options = {}) {
  if (String(request.method || "GET").toUpperCase() !== definition.method) {
    sendMethodNotAllowed(response, [definition.method]);
    return;
  }
  if (getCmsRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "CMS authentication origin is not allowed" });
    return;
  }
  const challenge = readMfaChallengeProxyCredential(request);
  const session = readSessionProxyCredentials(request);

  if (isValidCmsCookieToken(session.sessionToken) && challenge.present) {
    response.setHeader("Set-Cookie", clearCmsAuthenticationStateCookies());
    sendJson(response, 409, { error: "CMS authentication state is invalid" });
    return;
  }

  const env = options.env ?? runtimeEnv();
  const configuration = readCmsAuthConfiguration(env);
  if (!configuration) {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return;
  }
  const metadata = getCmsClientMetadata(request);
  const challengeToken = challenge.token;
  const useChallenge = definition.mode === "challenge" || (definition.mode === "either" && challenge.present);
  const identifier = useChallenge ? challengeToken : session.sessionToken;

  if (useChallenge && !isValidCmsCookieToken(challengeToken)) {
    sendJson(response, 401, {
      error: definition.authenticationFailure || "multifactor verification failed"
    });
    return;
  }

  if (!useChallenge && !isValidCmsCookieToken(session.sessionToken)) {
    sendJson(response, 401, { error: "CMS session is invalid or expired" });
    return;
  }

  if (
    !useChallenge &&
    (!isValidCmsCookieToken(session.csrfToken) || !cmsTokensMatch(session.browserCsrfToken, session.csrfToken))
  ) {
    sendJson(response, 403, { error: "CSRF validation failed" });
    return;
  }
  const limiter = options.mfaLimiter ?? defaultMfaLimiter;
  const nowMs = options.nowMs ?? Date.now();
  const keys = createCmsLoginRateLimitKeys({
    identifier,
    clientIp: metadata.clientIp,
    secret: configuration.proxySecret
  });
  const status = limiter.check(keys, nowMs);
  if (status.blocked) {
    sendRateLimitError(response, status);
    return;
  }
  let body = {};
  if (definition.body !== "empty") {
    try {
      body = await readJsonBody(request);
    } catch (error) {
      const failure = limiter.recordFailure(keys, nowMs);
      if (failure.blocked) {
        sendRateLimitError(response, failure);
        return;
      }
      sendJson(response, error instanceof RangeError ? 413 : 400, { error: "invalid MFA request" });
      return;
    }
  }
  const additional = { "Content-Type": "application/json" };
  if (useChallenge) {
    additional[CMS_MFA_CHALLENGE_TOKEN_HEADER] = challengeToken;
  } else {
    additional[CMS_SESSION_TOKEN_HEADER] = session.sessionToken;
    additional[CMS_CSRF_TOKEN_HEADER] = session.csrfToken;
  }
  if (definition.countAttempts === true) {
    limiter.recordFailure(keys, nowMs);
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let upstreamResponse;
  try {
    upstreamResponse = await fetchImpl(`${configuration.workerOrigin}${definition.path}`, {
      method: definition.method,
      headers: createPrivateHeaders(configuration, metadata, additional),
      body: JSON.stringify(body),
      redirect: "error"
    });
  } catch {
    sendJson(response, 502, { error: "CMS authentication upstream request failed" });
    return;
  }
  const upstreamBody = await readUpstreamJson(upstreamResponse);
  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 401 && definition.countAttempts !== true) {
      const failure = limiter.recordFailure(keys, nowMs);
      if (failure.blocked) {
        sendRateLimitError(response, failure);
        return;
      }
    }
    sendMfaProxyUpstreamError(response, upstreamResponse, upstreamBody, definition);
    return;
  }
  if (definition.countAttempts !== true) {
    limiter.recordSuccess(keys, nowMs);
  }

  if (definition.result === "session") {
    const sessionToken = upstreamResponse.headers.get(CMS_NEW_SESSION_TOKEN_HEADER) ?? "";
    const csrfToken = upstreamResponse.headers.get(CMS_NEW_CSRF_TOKEN_HEADER) ?? "";
    const assuranceNowMs = typeof options.assuranceNowMs === "number" ? options.assuranceNowMs : Date.now();
    const user = readSafeUserPayload(upstreamBody, assuranceNowMs);
    if (!isValidCmsCookieToken(sessionToken) || !isValidCmsCookieToken(csrfToken) || !user) {
      sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
      return;
    }
    response.setHeader("Set-Cookie", [...createCmsAuthCookies(sessionToken, csrfToken), clearCmsMfaChallengeCookie()]);
    sendJson(response, 200, { ok: true, user });
    return;
  }

  if (definition.result === "setup") {
    if (
      typeof upstreamBody?.manualEntryKey !== "string" ||
      typeof upstreamBody?.otpAuthUri !== "string" ||
      typeof upstreamBody?.expiresAt !== "string"
    ) {
      sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
      return;
    }
    sendJson(response, 200, {
      manualEntryKey: upstreamBody.manualEntryKey,
      otpAuthUri: upstreamBody.otpAuthUri,
      expiresAt: upstreamBody.expiresAt
    });
    return;
  }

  if (definition.result === "recovery") {
    if (
      !Array.isArray(upstreamBody?.recoveryCodes) ||
      upstreamBody.recoveryCodes.length !== 10 ||
      !upstreamBody.recoveryCodes.every((value) => typeof value === "string")
    ) {
      sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
      return;
    }
    const newSessionToken = upstreamResponse.headers.get(CMS_NEW_SESSION_TOKEN_HEADER) ?? "";
    const newCsrfToken = upstreamResponse.headers.get(CMS_NEW_CSRF_TOKEN_HEADER) ?? "";
    if (useChallenge && (!isValidCmsCookieToken(newSessionToken) || !isValidCmsCookieToken(newCsrfToken))) {
      sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
      return;
    }
    const cookies = useChallenge
      ? [...createCmsAuthCookies(newSessionToken, newCsrfToken), clearCmsMfaChallengeCookie()]
      : clearCmsAuthenticationStateCookies();
    response.setHeader("Set-Cookie", cookies);
    sendJson(response, 200, {
      ok: true,
      recoveryCodes: upstreamBody.recoveryCodes,
      loginRequired: !useChallenge
    });
    return;
  }

  if (definition.result === "regenerated") {
    if (
      !Array.isArray(upstreamBody?.recoveryCodes) ||
      upstreamBody.recoveryCodes.length !== 10 ||
      !upstreamBody.recoveryCodes.every((value) => typeof value === "string")
    ) {
      sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
      return;
    }
    sendJson(response, 200, { ok: true, recoveryCodes: upstreamBody.recoveryCodes });
    return;
  }

  if (definition.result === "disable") {
    response.setHeader("Set-Cookie", clearCmsAuthenticationStateCookies());
  }
  if (upstreamBody?.ok !== true) {
    sendJson(response, 502, { error: "CMS authentication upstream response is invalid" });
    return;
  }
  sendJson(response, 200, {
    ok: true,
    ...(definition.result === "reauth"
      ? {
          reauthenticated: true,
          recentPasswordAuthentication: true,
          recentMfaAuthentication: upstreamBody.mfaVerified === true
        }
      : definition.result === "disable"
        ? { disabled: true }
        : {})
  });
}

export function handleCmsMfaVerify(request, response, options = {}) {
  return handleCmsMfaProxy(
    request,
    response,
    {
      authenticationFailure: "multifactor verification failed",
      method: "POST",
      mode: "challenge",
      path: MFA_VERIFY_PATH,
      result: "session"
    },
    options
  );
}

export function handleCmsMfaSetupStart(request, response, options = {}) {
  return handleCmsMfaProxy(
    request,
    response,
    {
      authenticationFailure: "multifactor verification failed",
      body: "empty",
      conflictErrors: ["MFA is already configured"],
      method: "POST",
      mode: "either",
      path: MFA_SETUP_START_PATH,
      result: "setup"
    },
    options
  );
}

export function handleCmsMfaSetupConfirm(request, response, options = {}) {
  return handleCmsMfaProxy(
    request,
    response,
    {
      authenticationFailure: "multifactor verification failed",
      conflictErrors: ["MFA is already configured"],
      method: "POST",
      mode: "either",
      path: MFA_SETUP_CONFIRM_PATH,
      result: "recovery"
    },
    options
  );
}

export function handleCmsMfaRecoveryRegenerate(request, response, options = {}) {
  return handleCmsMfaProxy(
    request,
    response,
    {
      body: "empty",
      countAttempts: true,
      conflictErrors: ["MFA is not configured"],
      method: "POST",
      mode: "session",
      path: MFA_RECOVERY_REGENERATE_PATH,
      result: "regenerated"
    },
    options
  );
}

export function handleCmsMfaDisable(request, response, options = {}) {
  return handleCmsMfaProxy(
    request,
    response,
    {
      countAttempts: true,
      authenticationFailure: "MFA disable verification failed",
      conflictErrors: ["MFA is not configured", "MFA is required for this account"],
      method: "DELETE",
      mode: "session",
      path: MFA_DISABLE_PATH,
      result: "disable"
    },
    options
  );
}

export function handleCmsReauthenticate(request, response, options = {}) {
  return handleCmsMfaProxy(
    request,
    response,
    {
      authenticationFailure: "current authentication is invalid",
      method: "POST",
      mode: "session",
      path: REAUTHENTICATE_PATH,
      result: "reauth"
    },
    options
  );
}
