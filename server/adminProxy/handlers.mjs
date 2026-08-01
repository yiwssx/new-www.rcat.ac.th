import process from "node:process";
import { hasCmsSessionCookie, readCmsCsrfCookie, readCmsSessionCookie } from "../cmsAuth/cookies.mjs";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_BROWSER_CSRF_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER,
  cmsTokensMatch,
  getCmsClientMetadata,
  readCmsAuthConfiguration
} from "../cmsAuth/handlers.mjs";

const PROXY_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]);
const BODY_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const ADMIN_PATH_PREFIX = "/api/admin/";
const MAX_PROXY_BODY_BYTES = 1024 * 1024;
const CMS_SESSION_EXPIRED_ERROR = "CMS session is invalid or expired";
const SAFE_NON_SESSION_401_ERRORS = new Set(["MFA reset verification failed"]);

function runtimeEnv() {
  return process.env;
}

function getHeader(request, name) {
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

function getRequestOriginStatus(request) {
  const origin = getHeader(request, "origin");

  if (!origin) {
    return "allowed";
  }

  const host = getHeader(request, "x-forwarded-host") || getHeader(request, "host");
  const forwardedProtocol = getHeader(request, "x-forwarded-proto");

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
        throw new Error("request body is too large");
      }

      return request.body;
    }

    if (typeof request.body === "string") {
      const body = Buffer.from(request.body);

      if (body.length > maximumBytes) {
        throw new Error("request body is too large");
      }

      return body;
    }

    const body = Buffer.from(JSON.stringify(request.body));

    if (body.length > maximumBytes) {
      throw new Error("request body is too large");
    }

    return body;
  }

  const chunks = [];
  let length = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;

    if (length > maximumBytes) {
      throw new Error("request body is too large");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function validateTargetPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith(ADMIN_PATH_PREFIX) ||
    value.length > 2048 ||
    value.includes("\\") ||
    value.includes("#") ||
    value.includes("\0")
  ) {
    return null;
  }

  let target;

  try {
    target = new URL(value, "https://admin-proxy.invalid");
  } catch {
    return null;
  }

  if (target.origin !== "https://admin-proxy.invalid" || !target.pathname.startsWith(ADMIN_PATH_PREFIX)) {
    return null;
  }

  let decodedPath = target.pathname;

  for (let index = 0; index < 5; index += 1) {
    const segments = decodedPath.split("/");

    if (
      decodedPath.includes("\\") ||
      decodedPath.includes("\0") ||
      segments.some((segment) => segment === "." || segment === "..")
    ) {
      return null;
    }

    let nextDecoded;

    try {
      nextDecoded = decodeURIComponent(decodedPath);
    } catch {
      return null;
    }

    if (nextDecoded === decodedPath) {
      return `${target.pathname}${target.search}`;
    }

    decodedPath = nextDecoded;
  }

  return null;
}

function readTargetPath(request) {
  try {
    const requestUrl = new URL(request.url || "/", "https://admin-proxy.invalid");
    const values = requestUrl.searchParams.getAll("path");

    return values.length === 1 ? validateTargetPath(values[0]) : null;
  } catch {
    return null;
  }
}

function createCmsUpstreamHeaders(request, configuration, sessionToken, csrfToken) {
  const metadata = getCmsClientMetadata(request);
  const headers = new Headers({
    Accept: "application/json",
    [CMS_AUTH_PROXY_SECRET_HEADER]: configuration.proxySecret,
    [CMS_SESSION_TOKEN_HEADER]: sessionToken,
    [CMS_CLIENT_IP_HEADER]: metadata.clientIp,
    [CMS_USER_AGENT_HEADER]: metadata.userAgent
  });
  const contentType = getHeader(request, "content-type");
  const expectedRevision = getHeader(request, "x-rcat-expected-revision");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (expectedRevision) {
    headers.set("X-RCAT-Expected-Revision", expectedRevision);
  }

  if (csrfToken) {
    headers.set(CMS_CSRF_TOKEN_HEADER, csrfToken);
  }

  return headers;
}

async function getSafeUpstream401Error(response) {
  try {
    const payload = await response.clone().json();
    const error = payload && typeof payload === "object" && !Array.isArray(payload) ? payload.error : "";

    if (error === CMS_SESSION_EXPIRED_ERROR || SAFE_NON_SESSION_401_ERRORS.has(error)) {
      return error;
    }
  } catch {
    // Keep arbitrary upstream authentication details behind the finite proxy contract.
  }

  return "Admin request authentication failed";
}

export async function handleAdminProxyRequest(request, response, options = {}) {
  const env = options.env ?? runtimeEnv();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const method = String(request.method || "GET").toUpperCase();

  if (!PROXY_METHODS.has(method)) {
    sendMethodNotAllowed(response, [...PROXY_METHODS]);
    return;
  }

  if (getRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "admin proxy origin is not allowed" });
    return;
  }

  const configuration = readCmsAuthConfiguration(env);

  if (!configuration || typeof fetchImpl !== "function") {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return;
  }

  const cookieHeader = getHeader(request, "cookie");

  if (!hasCmsSessionCookie(cookieHeader)) {
    sendJson(response, 401, { error: "CMS session is required" });
    return;
  }

  const sessionToken = readCmsSessionCookie(cookieHeader);

  if (!sessionToken) {
    sendJson(response, 401, { error: "CMS session is invalid or expired" });
    return;
  }

  let csrfToken = "";

  if (BODY_METHODS.has(method)) {
    const csrfCookie = readCmsCsrfCookie(cookieHeader);
    const csrfHeader = getHeader(request, CMS_BROWSER_CSRF_HEADER);

    if (!cmsTokensMatch(csrfCookie, csrfHeader)) {
      sendJson(response, 403, { error: "CSRF validation failed" });
      return;
    }

    csrfToken = csrfHeader;
  }

  const targetPath = readTargetPath(request);

  if (!targetPath) {
    sendJson(response, 400, { error: "invalid admin proxy path" });
    return;
  }

  if (method === "OPTIONS") {
    sendEmpty(response, 204);
    return;
  }

  let requestBody;

  try {
    if (BODY_METHODS.has(method)) {
      const body = await readRequestBody(request, MAX_PROXY_BODY_BYTES);
      requestBody = body.length > 0 ? body : undefined;
    }
  } catch {
    sendJson(response, 413, { error: "admin proxy request body is too large" });
    return;
  }

  let upstreamResponse;

  try {
    upstreamResponse = await fetchImpl(`${configuration.workerOrigin}${targetPath}`, {
      method,
      headers: createCmsUpstreamHeaders(request, configuration, sessionToken, csrfToken),
      body: requestBody?.toString("utf8"),
      redirect: "error"
    });
  } catch {
    sendJson(response, 502, { error: "admin proxy upstream request failed" });
    return;
  }

  if (upstreamResponse.status === 401) {
    sendJson(response, 401, { error: await getSafeUpstream401Error(upstreamResponse) });
    return;
  }

  response.statusCode = upstreamResponse.status;
  response.setHeader("Cache-Control", "no-store");

  for (const headerName of ["content-type", "content-disposition", "etag"]) {
    const value = upstreamResponse.headers.get(headerName);

    if (value) {
      response.setHeader(headerName, value);
    }
  }

  response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
}
