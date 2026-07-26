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

const MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024;
const CMS_CAPABILITIES_PATH = "/api/admin/capabilities";
const CMS_MEDIA_BRIDGE_AUTHORIZATION_PATH = "/api/admin/media-bridge-authorization";
const CMS_STATUS_CAPABILITY = "media.read";
const STATUS_METHODS = new Set(["GET", "HEAD"]);
const APPS_SCRIPT_RESOURCES = new Map([
  ["media", "media"],
  ["deleteMedia", "media-delete"],
  ["startMediaUpload", "media-upload-start"],
  ["uploadMediaChunk", "media-upload-chunk"],
  ["queryMediaUploadStatus", "media-upload-status"]
]);

function runtimeEnv() {
  return process.env;
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendStatusJson(method, response, payload) {
  if (method === "HEAD") {
    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end();
    return;
  }

  sendJson(response, 200, payload);
}

function getHeader(request, name) {
  const value = request.headers?.[name.toLowerCase()];

  return Array.isArray(value) ? (value[0] ?? "") : typeof value === "string" ? value : "";
}

function isSameOriginRequest(request) {
  const origin = getHeader(request, "origin");

  if (!origin) {
    return true;
  }

  const host = getHeader(request, "x-forwarded-host") || getHeader(request, "host");
  const protocol = getHeader(request, "x-forwarded-proto");

  try {
    const parsedOrigin = new URL(origin);
    return (
      Boolean(host) &&
      parsedOrigin.host.toLowerCase() === host.toLowerCase() &&
      (!protocol || parsedOrigin.protocol === `${protocol.toLowerCase()}:`)
    );
  } catch {
    return false;
  }
}

function bodyToBuffer(body) {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  return Buffer.from(JSON.stringify(body));
}

async function readRequestBody(request) {
  if (request.body !== undefined) {
    const body = bodyToBuffer(request.body);

    if (body.length > MAX_REQUEST_BODY_BYTES) {
      throw new RangeError("request body is too large");
    }

    return body;
  }

  const chunks = [];
  let length = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;

    if (length > MAX_REQUEST_BODY_BYTES) {
      throw new RangeError("request body is too large");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody(request) {
  const body = await readRequestBody(request);

  if (body.length === 0) {
    throw new SyntaxError("request body is required");
  }

  const parsed = JSON.parse(body.toString("utf8"));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("request body must be a JSON object");
  }

  return parsed;
}

function readAppsScriptUrl(env) {
  const value = String(env.GOOGLE_APPS_SCRIPT_URL || env.APPS_SCRIPT_WEB_APP_URL || "").trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "script.google.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function readBridgeToken(env) {
  const value = typeof env.APPS_SCRIPT_BRIDGE_TOKEN === "string" ? env.APPS_SCRIPT_BRIDGE_TOKEN.trim() : "";
  return value || null;
}

function createCmsAuthorizationHeaders(request, configuration, sessionToken, csrfToken = "") {
  const metadata = getCmsClientMetadata(request);
  const headers = new Headers({
    Accept: "application/json",
    [CMS_AUTH_PROXY_SECRET_HEADER]: configuration.proxySecret,
    [CMS_SESSION_TOKEN_HEADER]: sessionToken,
    [CMS_CLIENT_IP_HEADER]: metadata.clientIp,
    [CMS_USER_AGENT_HEADER]: metadata.userAgent
  });

  if (csrfToken) {
    headers.set(CMS_CSRF_TOKEN_HEADER, csrfToken);
  }

  return headers;
}

async function readWorkerAuthorizationPayload(workerResponse) {
  try {
    const payload = await workerResponse.json();
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function authenticateCmsSession(request, response, env, fetchImpl, method) {
  const configuration = readCmsAuthConfiguration(env);

  if (!configuration || typeof fetchImpl !== "function") {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return null;
  }

  const cookieHeader = getHeader(request, "cookie");
  const sessionToken = readCmsSessionCookie(cookieHeader);

  if (!sessionToken) {
    sendJson(response, 401, { error: "CMS session is invalid or expired" });
    return null;
  }

  const isStatusRequest = STATUS_METHODS.has(method);
  let csrfToken = "";

  if (!isStatusRequest) {
    const csrfCookie = readCmsCsrfCookie(cookieHeader);
    const csrfHeader = getHeader(request, CMS_BROWSER_CSRF_HEADER);

    if (!cmsTokensMatch(csrfCookie, csrfHeader)) {
      sendJson(response, 403, { error: "CSRF validation failed" });
      return null;
    }

    csrfToken = csrfHeader;
  }

  let authorizationResponse;

  try {
    authorizationResponse = await fetchImpl(
      `${configuration.workerOrigin}${isStatusRequest ? CMS_CAPABILITIES_PATH : CMS_MEDIA_BRIDGE_AUTHORIZATION_PATH}`,
      {
        method: isStatusRequest ? "GET" : "POST",
        headers: createCmsAuthorizationHeaders(request, configuration, sessionToken, csrfToken),
        cache: "no-store",
        redirect: "error"
      }
    );
  } catch {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return null;
  }

  if (authorizationResponse.status === 401) {
    sendJson(response, 401, { error: "CMS session is invalid or expired" });
    return null;
  }

  if (!isStatusRequest) {
    if (authorizationResponse.status === 403) {
      const payload = await readWorkerAuthorizationPayload(authorizationResponse);
      sendJson(response, 403, {
        error:
          payload?.error === "CSRF validation failed" ? "CSRF validation failed" : "media bridge access is forbidden"
      });
      return null;
    }

    if (authorizationResponse.status === 428) {
      const payload = await readWorkerAuthorizationPayload(authorizationResponse);
      const assurance = payload?.assurance === "mfa" || payload?.assurance === "password" ? payload.assurance : null;
      sendJson(response, 428, {
        error: "reauthentication required",
        ...(assurance ? { assurance } : {})
      });
      return null;
    }

    if (authorizationResponse.status !== 204) {
      sendJson(response, 503, { error: "CMS authentication is unavailable" });
      return null;
    }

    return { mode: "cms-session" };
  }

  if (authorizationResponse.status === 403) {
    sendJson(response, 403, { error: "media bridge access is forbidden" });
    return null;
  }

  if (!authorizationResponse.ok) {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return null;
  }

  let capabilityPayload;

  try {
    capabilityPayload = await authorizationResponse.json();
  } catch {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return null;
  }

  if (
    !capabilityPayload ||
    typeof capabilityPayload !== "object" ||
    Array.isArray(capabilityPayload) ||
    !Array.isArray(capabilityPayload.capabilities) ||
    !capabilityPayload.capabilities.every((capability) => typeof capability === "string")
  ) {
    sendJson(response, 503, { error: "CMS authentication is unavailable" });
    return null;
  }

  if (!capabilityPayload.capabilities.includes(CMS_STATUS_CAPABILITY)) {
    sendJson(response, 403, { error: "media bridge access is forbidden" });
    return null;
  }

  return { mode: "cms-session" };
}

function sanitizeUpstreamBodySnippet(value, sensitiveValues) {
  let snippet = String(value || "");

  for (const sensitiveValue of sensitiveValues) {
    if (typeof sensitiveValue === "string" && sensitiveValue) {
      snippet = snippet.split(sensitiveValue).join("[redacted]");
    }
  }

  snippet = snippet
    .replace(
      /("(?:fileBase64|chunkBase64|uploadUrl|upload_id|uploadKey|rcatUploadKey|authToken|appsScriptBridgeToken|mediaBridgeToken)"\s*:\s*)"[^"]*"/gi,
      '$1"[redacted]"'
    )
    .replace(
      /((?:fileBase64|chunkBase64|uploadUrl|upload_id|uploadKey|rcatUploadKey|authToken|appsScriptBridgeToken|mediaBridgeToken)=)[^\s&"]+/gi,
      "$1[redacted]"
    )
    .replace(/([?&](?:upload_id|uploadKey|rcatUploadKey)=)[^\s&"']+/gi, "$1[redacted]");

  return snippet.slice(0, 300);
}

function createUpstreamPayload(payload, bridgeToken) {
  const nextPayload = { ...payload };
  delete nextPayload.authToken;
  delete nextPayload.appsScriptBridgeToken;
  delete nextPayload.mediaBridgeToken;

  return {
    ...nextPayload,
    appsScriptBridgeToken: bridgeToken
  };
}

export async function handleAppsScriptProxyRequest(request, response, { env = runtimeEnv(), fetchImpl = fetch } = {}) {
  const method = String(request.method || "GET").toUpperCase();

  if (!STATUS_METHODS.has(method) && method !== "POST") {
    response.setHeader("Allow", "GET, HEAD, POST");
    sendJson(response, 405, { error: "method not allowed" });
    return;
  }

  if (!isSameOriginRequest(request)) {
    sendJson(response, 403, { error: "cross-origin request is not allowed" });
    return;
  }

  const cookieHeader = getHeader(request, "cookie");

  if (!hasCmsSessionCookie(cookieHeader)) {
    sendJson(response, 401, { error: "CMS session is invalid or expired" });
    return;
  }

  const session = await authenticateCmsSession(request, response, env, fetchImpl, method);

  if (!session) {
    return;
  }

  const appsScriptUrl = readAppsScriptUrl(env);
  const bridgeToken = readBridgeToken(env);

  if (STATUS_METHODS.has(method)) {
    const connectionStatus = appsScriptUrl && bridgeToken ? "connected" : "not-configured";

    sendStatusJson(method, response, {
      mode: "server-proxy",
      appsScriptBridge: connectionStatus,
      driveStorage: connectionStatus
    });
    return;
  }

  if (!appsScriptUrl) {
    sendJson(response, 503, { error: "Apps Script URL is not configured" });
    return;
  }

  if (!bridgeToken) {
    sendJson(response, 503, { error: "Apps Script bridge token is not configured" });
    return;
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RangeError) {
      sendJson(response, 413, {
        error: "request body is too large",
        code: "FUNCTION_PAYLOAD_TOO_LARGE"
      });
      return;
    }

    sendJson(response, 400, { error: "invalid JSON request body" });
    return;
  }

  const upstreamResource = APPS_SCRIPT_RESOURCES.get(body.resource);

  if (!upstreamResource || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    sendJson(response, 400, { error: "invalid Apps Script media resource or payload" });
    return;
  }

  appsScriptUrl.searchParams.set("resource", upstreamResource);
  const upstreamPayload = createUpstreamPayload(body.payload, bridgeToken);

  try {
    const upstreamResponse = await fetchImpl(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(upstreamPayload),
      cache: "no-store",
      redirect: "follow"
    });

    const upstreamBody = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      sendJson(response, 502, {
        error: "Apps Script bridge failed",
        diagnostic: "apps-script-bridge-upstream-v2",
        upstreamStatus: upstreamResponse.status,
        upstreamBodySnippet: sanitizeUpstreamBodySnippet(upstreamBody, [
          body.payload.fileBase64,
          body.payload.chunkBase64,
          body.payload.uploadUrl,
          body.payload.upload_id,
          body.payload.uploadKey,
          body.payload.rcatUploadKey,
          body.payload.authToken,
          body.payload.appsScriptBridgeToken,
          body.payload.mediaBridgeToken,
          bridgeToken
        ]),
        upstreamResource
      });
      return;
    }

    let upstreamPayloadResult;
    try {
      upstreamPayloadResult = JSON.parse(upstreamBody);
    } catch {
      sendJson(response, 502, {
        error: "Apps Script bridge returned an invalid response",
        diagnostic: "apps-script-bridge-upstream-v2",
        upstreamStatus: upstreamResponse.status,
        upstreamBodySnippet: sanitizeUpstreamBodySnippet(upstreamBody, [
          body.payload.fileBase64,
          body.payload.chunkBase64,
          body.payload.uploadUrl,
          body.payload.upload_id,
          body.payload.uploadKey,
          body.payload.rcatUploadKey,
          body.payload.authToken,
          body.payload.appsScriptBridgeToken,
          body.payload.mediaBridgeToken,
          bridgeToken
        ]),
        upstreamResource
      });
      return;
    }

    sendJson(response, 200, upstreamPayloadResult);
  } catch {
    sendJson(response, 502, { error: "Apps Script bridge failed" });
  }
}

export { MAX_REQUEST_BODY_BYTES };
