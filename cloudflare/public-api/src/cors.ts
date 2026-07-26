import type { Env } from "./env";

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type";
const ADMIN_ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const ADMIN_ALLOWED_HEADERS = "Content-Type, X-RCAT-Expected-Revision";

function getConfiguredOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function stripSurroundingQuotes(value: string) {
  const trimmed = value.trim();
  const first = trimmed.at(0);
  const last = trimmed.at(-1);

  return trimmed.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

function normalizeOrigin(value: string | null | undefined) {
  const cleaned = stripSurroundingQuotes(value ?? "");

  if (!cleaned) {
    return null;
  }

  try {
    return new URL(cleaned).origin;
  } catch {
    return null;
  }
}

function getConfiguredAdminOrigins(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => Boolean(origin))
    )
  );
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
  const configuredOrigins = isAdmin
    ? getConfiguredAdminOrigins(env.ADMIN_WRITE_ALLOWED_ORIGINS)
    : getConfiguredOrigins(env.PUBLIC_API_ALLOWED_ORIGINS);
  const requestOrigin = request.headers.get("Origin");

  if (configuredOrigins.length === 0) {
    if (isAdmin) {
      return headers;
    }

    headers.set("Access-Control-Allow-Origin", "*");
    return headers;
  }

  headers.set("Vary", "Origin");

  const requestOriginMatches = requestOrigin
    ? isAdmin
      ? configuredOrigins.includes(normalizeOrigin(requestOrigin) ?? "")
      : configuredOrigins.includes(requestOrigin)
    : false;

  if (requestOrigin && requestOriginMatches) {
    headers.set("Access-Control-Allow-Origin", requestOrigin);

    if (isAdmin) {
      headers.set("Access-Control-Allow-Credentials", "true");
    }
  }

  return headers;
}
