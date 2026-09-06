import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { isValidCmsCookieToken } from "./cookies.mjs";

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

const MAX_LOGIN_BODY_BYTES = 16 * 1024;
const RECENT_AUTHENTICATION_WINDOW_MS = 10 * 60 * 1000;

export function getRequestHeader(request, name) {
  if (typeof request.headers?.get === "function") {
    return request.headers.get(name) ?? "";
  }

  const value = request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? "") : typeof value === "string" ? value : "";
}

export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function sendEmpty(response, status) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

export function sendMethodNotAllowed(response, allowedMethods) {
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

export async function readJsonBody(request) {
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
  // Vercel documents x-forwarded-for as the public client-IP contract and
  // overwrites it at the platform edge to prevent spoofing. Prefer that stable
  // value across separate serverless routes; retain legacy headers only as
  // bounded fallbacks for non-Vercel/local execution.
  for (const headerName of ["x-forwarded-for", "x-vercel-forwarded-for", "x-real-ip"]) {
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

export function createPrivateHeaders(configuration, metadata, additional = {}) {
  return new Headers({
    Accept: "application/json",
    [CMS_AUTH_PROXY_SECRET_HEADER]: configuration.proxySecret,
    [CMS_CLIENT_IP_HEADER]: metadata.clientIp,
    [CMS_USER_AGENT_HEADER]: metadata.userAgent,
    ...additional
  });
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

export function readSafeUserPayload(value, nowMs = Date.now()) {
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

export async function readUpstreamSafeUser(response, nowMs = Date.now()) {
  try {
    return readSafeUserPayload(await response.json(), nowMs);
  } catch {
    return null;
  }
}

export function sendGenericUpstreamError(response, upstreamResponse, login = false) {
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
