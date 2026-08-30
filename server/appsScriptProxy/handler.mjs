import { createHash } from "node:crypto";
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
const MAX_FACEBOOK_THUMBNAIL_BYTES = 5 * 1024 * 1024;
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

function isAllowedFacebookPageHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "facebook.com" || host === "www.facebook.com" || host === "m.facebook.com";
}

function normalizeFacebookSourceUrl(value) {
  const sourceUrl = String(value || "").trim();
  const parsed = new URL(sourceUrl);

  if (
    parsed.protocol !== "https:" ||
    !isAllowedFacebookPageHost(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    throw new TypeError("invalid Facebook content URL");
  }

  parsed.hash = "";
  return parsed.toString();
}

function decodeFacebookHtmlValue(value) {
  return String(value || "")
    .replace(/\\\//g, "/")
    .replace(/\\u0025/gi, "%")
    .replace(/\\u0026/gi, "&")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function isAllowedFacebookImageHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "fbcdn.net" ||
    host.endsWith(".fbcdn.net") ||
    host === "fbsbx.com" ||
    host.endsWith(".fbsbx.com")
  );
}

function normalizeFacebookImageUrl(value) {
  try {
    const parsed = new URL(decodeFacebookHtmlValue(value));
    if (
      parsed.protocol !== "https:" ||
      !isAllowedFacebookImageHost(parsed.hostname) ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function extractMetaContent(html, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = normalizeFacebookImageUrl(match?.[1]);
    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function extractFacebookImageUrl(html) {
  const normalizedHtml = String(html || "").replace(/\\\//g, "/");
  const metaCandidate =
    extractMetaContent(normalizedHtml, "og:image") ||
    extractMetaContent(normalizedHtml, "og:image:url") ||
    extractMetaContent(normalizedHtml, "twitter:image");

  if (metaCandidate) {
    return metaCandidate;
  }

  const urls = normalizedHtml.match(/https:\/\/[^\s"'<>]+/gi) ?? [];
  for (const value of urls) {
    const candidate = normalizeFacebookImageUrl(value);
    if (candidate && /(?:fbcdn\.net|fbsbx\.com)/i.test(candidate)) {
      return candidate;
    }
  }

  return "";
}

function createFacebookPluginUrls(sourceUrl) {
  const encoded = encodeURIComponent(sourceUrl);
  return [
    sourceUrl,
    `https://www.facebook.com/plugins/post.php?href=${encoded}&show_text=true&width=500`,
    `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=true&width=500`
  ];
}

async function resolveFacebookPreviewImage(sourceUrl, fetchImpl) {
  for (const candidateUrl of createFacebookPluginUrls(sourceUrl)) {
    try {
      const response = await fetchImpl(candidateUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (compatible; RCATThumbnailBot/1.0; +https://www.rcat.ac.th/)"
        },
        cache: "no-store",
        redirect: "follow"
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const imageUrl = extractFacebookImageUrl(html);
      if (imageUrl) {
        return imageUrl;
      }
    } catch {
      // Try the next public Facebook representation.
    }
  }

  return "";
}

function extensionForImageMimeType(mimeType) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return "jpg";
  }
}

async function createFacebookThumbnailMediaPayload(payload, fetchImpl) {
  const sourceUrl = normalizeFacebookSourceUrl(payload.sourceUrl);
  const imageUrl = await resolveFacebookPreviewImage(sourceUrl, fetchImpl);

  if (!imageUrl) {
    throw new Error("Facebook preview image is unavailable");
  }

  const imageResponse = await fetchImpl(imageUrl, {
    method: "GET",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      Referer: "https://www.facebook.com/",
      "User-Agent": "Mozilla/5.0 (compatible; RCATThumbnailBot/1.0; +https://www.rcat.ac.th/)"
    },
    cache: "no-store",
    redirect: "follow"
  });

  if (!imageResponse.ok) {
    throw new Error("Facebook preview image download failed");
  }

  const mimeType = String(imageResponse.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error("Facebook preview did not return an image");
  }

  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_FACEBOOK_THUMBNAIL_BYTES) {
    throw new RangeError("Facebook preview image is too large");
  }

  const fingerprint = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 24);
  const id = `facebook-thumbnail-${fingerprint}`;
  const fileName = `${id}.${extensionForImageMimeType(mimeType)}`;

  return {
    id,
    name: String(payload.name || "Facebook thumbnail").trim().slice(0, 160) || "Facebook thumbnail",
    type: "image",
    owner: String(payload.owner || "ผู้แก้ไข CMS").trim().slice(0, 160) || "ผู้แก้ไข CMS",
    fileName,
    fileBase64: bytes.toString("base64"),
    mimeType
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

  const isFacebookThumbnailRequest = body.resource === "facebookThumbnail";
  const upstreamResource = isFacebookThumbnailRequest ? "media" : APPS_SCRIPT_RESOURCES.get(body.resource);

  if (!upstreamResource || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    sendJson(response, 400, { error: "invalid Apps Script media resource or payload" });
    return;
  }

  let bridgePayload = body.payload;
  if (isFacebookThumbnailRequest) {
    try {
      bridgePayload = await createFacebookThumbnailMediaPayload(body.payload, fetchImpl);
    } catch (error) {
      const status = error instanceof TypeError ? 400 : error instanceof RangeError ? 413 : 422;
      sendJson(response, status, {
        error: status === 400 ? "invalid Facebook content URL" : "Unable to create Facebook thumbnail"
      });
      return;
    }
  }

  appsScriptUrl.searchParams.set("resource", upstreamResource);
  const upstreamPayload = createUpstreamPayload(bridgePayload, bridgeToken);

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
          bridgePayload.fileBase64,
          bridgePayload.chunkBase64,
          bridgePayload.uploadUrl,
          bridgePayload.upload_id,
          bridgePayload.uploadKey,
          bridgePayload.rcatUploadKey,
          bridgePayload.authToken,
          bridgePayload.appsScriptBridgeToken,
          bridgePayload.mediaBridgeToken,
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
          bridgePayload.fileBase64,
          bridgePayload.chunkBase64,
          bridgePayload.uploadUrl,
          bridgePayload.upload_id,
          bridgePayload.uploadKey,
          bridgePayload.rcatUploadKey,
          bridgePayload.authToken,
          bridgePayload.appsScriptBridgeToken,
          bridgePayload.mediaBridgeToken,
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
