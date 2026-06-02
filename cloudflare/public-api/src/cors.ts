import type { Env } from "./env";

const ALLOWED_METHODS = "GET, OPTIONS";
const ALLOWED_HEADERS = "Content-Type";

function getConfiguredOrigins(env: Env) {
  return (env.PUBLIC_API_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getCorsHeaders(request: Request, env: Env) {
  const headers = new Headers({
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS
  });
  const configuredOrigins = getConfiguredOrigins(env);
  const requestOrigin = request.headers.get("Origin");

  if (configuredOrigins.length === 0) {
    headers.set("Access-Control-Allow-Origin", "*");
    return headers;
  }

  headers.set("Vary", "Origin");

  if (requestOrigin && configuredOrigins.includes(requestOrigin)) {
    headers.set("Access-Control-Allow-Origin", requestOrigin);
  }

  return headers;
}
