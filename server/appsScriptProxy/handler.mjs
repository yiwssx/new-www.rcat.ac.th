import process from "node:process";

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
  const value = String(
    env.GOOGLE_APPS_SCRIPT_URL || env.APPS_SCRIPT_WEB_APP_URL || env.VITE_GOOGLE_APPS_SCRIPT_URL || ""
  ).trim();

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

export async function handleAppsScriptProxyRequest(request, response, { env = runtimeEnv(), fetchImpl = fetch } = {}) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "method not allowed" });
    return;
  }

  if (!isSameOriginRequest(request)) {
    sendJson(response, 403, { error: "cross-origin request is not allowed" });
    return;
  }

  const appsScriptUrl = readAppsScriptUrl(env);

  if (!appsScriptUrl) {
    sendJson(response, 503, { error: "Apps Script URL is not configured" });
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

  try {
    const upstreamResponse = await fetchImpl(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(body.payload),
      cache: "no-store",
      redirect: "follow"
    });

    if (!upstreamResponse.ok) {
      sendJson(response, 502, { error: "Apps Script bridge failed" });
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
