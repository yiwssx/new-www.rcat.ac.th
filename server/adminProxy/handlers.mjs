import process from "node:process";
import {
  clearAdminProxySessionCookie,
  createAdminProxySessionCookie,
  getAdminProxyAllowedEmails,
  verifyAdminProxySessionCookie
} from "./session.mjs";

const PROXY_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]);
const BODY_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const ADMIN_PATH_PREFIX = "/api/admin/";
const MAX_PROXY_BODY_BYTES = 1024 * 1024;
const MAX_LOGIN_BODY_BYTES = 16 * 1024;

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

async function readJsonBody(request) {
  const body = await readRequestBody(request, MAX_LOGIN_BODY_BYTES);

  if (body.length === 0) {
    throw new Error("request body is required");
  }

  const parsed = JSON.parse(body.toString("utf8"));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("request body must be a JSON object");
  }

  return parsed;
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getRoleEmails(value) {
  return getAdminProxyAllowedEmails(value);
}

function getAdminProxyRbac(env) {
  return {
    admin: getRoleEmails(env.ADMIN_RBAC_ADMINS),
    editor: getRoleEmails(env.ADMIN_RBAC_EDITORS),
    viewer: getRoleEmails(env.ADMIN_RBAC_VIEWERS)
  };
}

function hasDuplicateRoleAssignment(roleEmails) {
  const seen = new Map();

  for (const [role, emails] of Object.entries(roleEmails)) {
    for (const email of emails) {
      const existingRole = seen.get(email);

      if (existingRole && existingRole !== role) {
        return true;
      }

      seen.set(email, role);
    }
  }

  return false;
}

function resolveAdminProxyRole(email, env) {
  const normalizedEmail = normalizeEmail(email);
  const roleEmails = getAdminProxyRbac(env);

  if (!normalizedEmail || hasDuplicateRoleAssignment(roleEmails)) {
    return "";
  }

  if (roleEmails.admin.includes(normalizedEmail)) {
    return "admin";
  }

  if (roleEmails.editor.includes(normalizedEmail)) {
    return "editor";
  }

  if (roleEmails.viewer.includes(normalizedEmail)) {
    return "viewer";
  }

  return "";
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

function readProxyConfiguration(env) {
  const workerUrlValue = typeof env.CLOUDFLARE_ADMIN_API_URL === "string" ? env.CLOUDFLARE_ADMIN_API_URL.trim() : "";
  const smokeToken =
    typeof env.CLOUDFLARE_ADMIN_SMOKE_TOKEN === "string" ? env.CLOUDFLARE_ADMIN_SMOKE_TOKEN.trim() : "";
  let workerUrl;

  try {
    workerUrl = new URL(workerUrlValue);
  } catch {
    return null;
  }

  if (
    workerUrl.protocol !== "https:" ||
    workerUrl.username ||
    workerUrl.password ||
    workerUrl.search ||
    workerUrl.hash ||
    (workerUrl.pathname !== "/" && workerUrl.pathname !== "") ||
    !smokeToken
  ) {
    return null;
  }

  return { smokeToken, workerOrigin: workerUrl.origin };
}

async function authenticateProxySession(request, response, env, nowMs) {
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

function getTargetPathSegments(targetPath) {
  const pathname = targetPath.slice(ADMIN_PATH_PREFIX.length).split("?", 1)[0];
  return pathname.split("/").filter(Boolean);
}

function getAdminProxyMutationPermissionError(role, method, targetPath) {
  if (!BODY_METHODS.has(method)) {
    return "";
  }

  const segments = getTargetPathSegments(targetPath);
  const route = segments[0] || "";

  if (["content", "documents", "carousel", "external-services", "events", "media"].includes(route)) {
    return role === "admin" || role === "editor" ? "" : "content management permission is required";
  }

  if (["settings", "home-sections", "visitor-stats"].includes(route)) {
    return role === "admin" ? "" : "website settings permission is required";
  }

  if (route === "menu") {
    return role === "admin" ? "" : "menu management permission is required";
  }

  if (route === "users") {
    if (role === "admin") {
      return "";
    }

    return role === "editor" && method === "PATCH" && segments.length === 2
      ? ""
      : "user management permission is required";
  }

  return role === "admin" ? "" : "admin role is required";
}

function getAdminProxyPermissionError(role, method, targetPath) {
  const segments = getTargetPathSegments(targetPath);
  const route = segments[0] || "";

  if (route === "backup") {
    return role === "admin" ? "" : "admin role is required";
  }

  return getAdminProxyMutationPermissionError(role, method, targetPath);
}

function createUpstreamHeaders(request, smokeToken, session) {
  const headers = new Headers({
    Accept: "application/json",
    "X-RCAT-Admin-Smoke-Token": smokeToken
  });
  const contentType = getHeader(request, "content-type");
  const expectedRevision = getHeader(request, "x-rcat-expected-revision");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (expectedRevision) {
    headers.set("X-RCAT-Expected-Revision", expectedRevision);
  }

  if (session?.email) {
    headers.set("X-RCAT-Admin-Proxy-Email", session.email);
  }

  if (session?.role) {
    headers.set("X-RCAT-Admin-Proxy-Role", session.role);
  }

  return headers;
}

async function defaultComparePassword(password, passwordHash) {
  const bcryptModule = await import("bcryptjs");
  const bcrypt = bcryptModule.default ?? bcryptModule;

  return bcrypt.compare(password, passwordHash);
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

  const session = await authenticateProxySession(request, response, env, options.nowMs ?? Date.now());

  if (!session) {
    return;
  }

  const targetPath = readTargetPath(request);

  if (!targetPath) {
    sendJson(response, 400, { error: "invalid admin proxy path" });
    return;
  }

  const permissionError = getAdminProxyPermissionError(session.role, method, targetPath);

  if (permissionError) {
    sendJson(response, 403, { error: permissionError });
    return;
  }

  if (method === "OPTIONS") {
    sendEmpty(response, 204);
    return;
  }

  const configuration = readProxyConfiguration(env);

  if (!configuration || typeof fetchImpl !== "function") {
    sendJson(response, 503, { error: "admin proxy upstream is not configured" });
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
      headers: createUpstreamHeaders(request, configuration.smokeToken, session),
      body: requestBody?.toString("utf8"),
      redirect: "error"
    });
  } catch {
    sendJson(response, 502, { error: "admin proxy upstream request failed" });
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

export async function handleAdminProxySessionLogin(request, response, options = {}) {
  if (String(request.method || "GET").toUpperCase() !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  if (getRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "admin proxy origin is not allowed" });
    return;
  }

  const env = options.env ?? runtimeEnv();
  const allowedEmails = getAdminProxyAllowedEmails(env.ADMIN_PROXY_ALLOWED_EMAILS);
  const passwordHash = typeof env.ADMIN_PROXY_PASSWORD_HASH === "string" ? env.ADMIN_PROXY_PASSWORD_HASH.trim() : "";
  const missing = [];

  if (allowedEmails.length === 0) {
    missing.push("ADMIN_PROXY_ALLOWED_EMAILS");
  }

  if (!passwordHash) {
    missing.push("ADMIN_PROXY_PASSWORD_HASH");
  }

  if (missing.length > 0) {
    sendJson(response, 503, {
      error: "admin proxy authentication is not configured",
      missing,
      diagnostic: "admin-proxy-auth-env-v1"
    });
    return;
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: "invalid login request" });
    return;
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    sendJson(response, 401, { error: "invalid email or password" });
    return;
  }

  const comparePassword = options.comparePassword ?? defaultComparePassword;
  let passwordMatches;

  try {
    passwordMatches = await comparePassword(password, passwordHash);
  } catch {
    sendJson(response, 503, { error: "admin proxy authentication is not configured" });
    return;
  }

  if (!passwordMatches || !allowedEmails.includes(email)) {
    sendJson(response, 401, { error: "invalid email or password" });
    return;
  }

  const role = resolveAdminProxyRole(email, env);

  if (!role) {
    sendJson(response, 401, { error: "invalid email or password" });
    return;
  }

  let cookie;

  try {
    cookie = await createAdminProxySessionCookie({
      email,
      role,
      secret: env.ADMIN_PROXY_SESSION_SECRET,
      nowMs: options.nowMs ?? Date.now()
    });
  } catch {
    sendJson(response, 503, { error: "admin proxy session is not configured" });
    return;
  }

  response.setHeader("Set-Cookie", cookie);
  sendJson(response, 200, { ok: true, role });
}

export async function handleAdminProxySessionLogout(request, response) {
  if (String(request.method || "GET").toUpperCase() !== "POST") {
    sendMethodNotAllowed(response, ["POST"]);
    return;
  }

  if (getRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "admin proxy origin is not allowed" });
    return;
  }

  response.setHeader("Set-Cookie", clearAdminProxySessionCookie());
  sendEmpty(response, 204);
}
