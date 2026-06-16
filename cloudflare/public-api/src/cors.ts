import type { Env } from "./env";

const ALLOWED_METHODS = "GET, OPTIONS";
const ALLOWED_HEADERS = "Content-Type";
const ADMIN_ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const ADMIN_ALLOWED_HEADERS = "Content-Type, Cf-Access-Jwt-Assertion, X-RCAT-Admin-Smoke-Token, If-Match";

function getConfiguredOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAdminWriteRequest(request: Request) {
  try {
    return new URL(request.url).pathname.startsWith("/api/admin/");
  } catch {
    return false;
  }
}

export function getCorsHeaders(request: Request, env: Env) {
  const isAdmin = isAdminWriteRequest(request);
  const headers = new Headers({
    "Access-Control-Allow-Headers": isAdmin ? ADMIN_ALLOWED_HEADERS : ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": isAdmin ? ADMIN_ALLOWED_METHODS : ALLOWED_METHODS
  });
  const configuredOrigins = getConfiguredOrigins(
    isAdmin ? env.ADMIN_WRITE_ALLOWED_ORIGINS : env.PUBLIC_API_ALLOWED_ORIGINS
  );
  const requestOrigin = request.headers.get("Origin");

  if (configuredOrigins.length === 0) {
    if (isAdmin) {
      return headers;
    }

    headers.set("Access-Control-Allow-Origin", "*");
    return headers;
  }

  headers.set("Vary", "Origin");

  if (requestOrigin && configuredOrigins.includes(requestOrigin)) {
    headers.set("Access-Control-Allow-Origin", requestOrigin);
  }

  return headers;
}
