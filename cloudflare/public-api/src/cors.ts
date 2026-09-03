import type { Env } from "./env";

const PUBLIC_READ_ALLOWED_METHODS = "GET, POST, OPTIONS";
const PUBLIC_ANALYTICS_ALLOWED_METHODS = "POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type";
const ADMIN_ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const ADMIN_ALLOWED_HEADERS = "Content-Type, X-RCAT-Expected-Revision";
const PUBLIC_ANALYTICS_PATHS = new Set([
  "/api/public/site-view",
  "/api/public/presence",
  "/api/public/content-view",
  "/api/public/runtime-incident"
]);

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

function getConfiguredNormalizedOrigins(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => Boolean(origin))
    )
  );
}

function getRequestPathname(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

function isAdminWriteRequest(request: Request) {
  return getRequestPathname(request).startsWith("/api/admin/");
}

function isPublicAnalyticsRequest(request: Request) {
  return PUBLIC_ANALYTICS_PATHS.has(getRequestPathname(request));
}

function getAllowedMethods(isAdmin: boolean, isPublicAnalytics: boolean) {
  if (isAdmin) {
    return ADMIN_ALLOWED_METHODS;
  }

  return isPublicAnalytics ? PUBLIC_ANALYTICS_ALLOWED_METHODS : PUBLIC_READ_ALLOWED_METHODS;
}

function getAllowedOrigins(isAdmin: boolean, isPublicAnalytics: boolean, env: Env) {
  if (isAdmin) {
    return getConfiguredNormalizedOrigins(env.ADMIN_WRITE_ALLOWED_ORIGINS);
  }

  if (isPublicAnalytics) {
    return getConfiguredNormalizedOrigins(env.PUBLIC_ANALYTICS_ALLOWED_ORIGINS);
  }

  return getConfiguredOrigins(env.PUBLIC_API_ALLOWED_ORIGINS);
}

export function isPublicAnalyticsOriginAllowed(request: Request, env: Env) {
  const requestOrigin = request.headers.get("Origin");

  // Non-browser/server-to-server clients do not send Origin. They remain
  // governed by the existing edge-backed telemetry rate limits.
  if (!requestOrigin) {
    return true;
  }

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedRequestOrigin) {
    return false;
  }

  return getConfiguredNormalizedOrigins(env.PUBLIC_ANALYTICS_ALLOWED_ORIGINS).includes(normalizedRequestOrigin);
}

export function getCorsHeaders(request: Request, env: Env) {
  const isAdmin = isAdminWriteRequest(request);
  const isPublicAnalytics = isPublicAnalyticsRequest(request);
  const headers = new Headers({
    "Access-Control-Allow-Headers": isAdmin ? ADMIN_ALLOWED_HEADERS : ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": getAllowedMethods(isAdmin, isPublicAnalytics)
  });
  const configuredOrigins = getAllowedOrigins(isAdmin, isPublicAnalytics, env);
  const requestOrigin = request.headers.get("Origin");

  if (configuredOrigins.length === 0) {
    if (isAdmin || isPublicAnalytics) {
      return headers;
    }

    headers.set("Access-Control-Allow-Origin", "*");
    return headers;
  }

  headers.set("Vary", "Origin");

  const requestOriginMatches = requestOrigin
    ? isAdmin || isPublicAnalytics
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
