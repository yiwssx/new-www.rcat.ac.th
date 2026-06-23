import process from "node:process";
import { getAdminProxyAllowedEmails, verifyAdminProxySessionCookie } from "../adminProxy/session.mjs";

const MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024;
const APPS_SCRIPT_RESOURCES = new Map([
  ["media", "media"],
  ["deleteMedia", "media-delete"]
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

async function authenticateAdminProxySession(request, response, env, nowMs) {
  const allowedEmails = getAdminProxyAllowedEmails(env.ADMIN_PROXY_ALLOWED_EMAILS);

  if (allowedEmails.length === 0) {
    sendJson(response, 503, { error: "admin proxy session is not configured" });
    return null;
  }

  const result = await verifyAdminProxySessionCookie({
    allowedEmails,
    cookieHeader: getHeader(request, "cookie"),
    nowMs,
    secret: env.ADMIN_PROXY_SESSION_SECRET
  });

  if (result.status === "missing") {
    sendJson(response, 401, { error: "admin proxy session is required" });
    return null;
  }

  if (result.status === "forbidden") {
    sendJson(response, 403, { error: "admin proxy identity is not allowed" });
    return null;
  }

  if (result.status !== "valid") {
    sendJson(response, 401, { error: "admin proxy session is invalid or expired" });
    return null;
  }

  return result;
}

function sanitizeUpstreamBodySnippet(value, sensitiveValues) {
  let snippet = String(value || "");

  for (const sensitiveValue of sensitiveValues) {
    if (typeof sensitiveValue === "string" && sensitiveValue) {
      snippet = snippet.split(sensitiveValue).join("[redacted]");
    }
  }

  snippet = snippet
    .replace(/("(?:fileBase64|authToken|appsScriptBridgeToken|mediaBridgeToken)"\s*:\s*)"[^"]*"/gi, '$1"[redacted]"')
    .replace(/((?:fileBase64|authToken|appsScriptBridgeToken|mediaBridgeToken)=)[^\s&"]+/gi, "$1[redacted]");

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

export async function handleAppsScriptProxyRequest(
  request,
  response,
  { env = runtimeEnv(), fetchImpl = fetch, nowMs = Date.now() } = {}
) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "method not allowed" });
    return;
  }

  if (!isSameOriginRequest(request)) {
    sendJson(response, 403, { error: "cross-origin request is not allowed" });
    return;
  }

  const session = await authenticateAdminProxySession(request, response, env, nowMs);

  if (!session) {
    return;
  }

  const appsScriptUrl = readAppsScriptUrl(env);
  const bridgeToken = readBridgeToken(env);

  if (request.method === "GET") {
    sendJson(response, 200, {
      mode: "server-proxy",
      configured: Boolean(appsScriptUrl && bridgeToken),
      appsScriptUrlConfigured: Boolean(appsScriptUrl),
      bridgeTokenConfigured: Boolean(bridgeToken)
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
      sendJson(response, 413, { error: "request body is too large" });
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

    if (!upstreamResponse.ok) {
      const upstreamBody = await upstreamResponse.text();
      sendJson(response, 502, {
        error: "Apps Script bridge failed",
        diagnostic: "apps-script-bridge-upstream-v2",
        upstreamStatus: upstreamResponse.status,
        upstreamBodySnippet: sanitizeUpstreamBodySnippet(upstreamBody, [
          body.payload.fileBase64,
          body.payload.authToken,
          body.payload.appsScriptBridgeToken,
          body.payload.mediaBridgeToken,
          bridgeToken
        ]),
        upstreamResource
      });
      return;
    }

    let payload;

    try {
      payload = await upstreamResponse.json();
    } catch {
      sendJson(response, 502, { error: "Apps Script bridge returned an invalid response" });
      return;
    }

    sendJson(response, 200, payload);
  } catch {
    sendJson(response, 502, { error: "Apps Script bridge failed" });
  }
}

export { MAX_REQUEST_BODY_BYTES };
