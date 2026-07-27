const BLOCKED_PUBLIC_TELEMETRY_PATHS = new Set(["/login", "/activate-account", "/reset-password", "/admin"]);

export function normalizePublicTelemetryPath(pathname: string) {
  const [pathWithoutQueryOrHash] = String(pathname || "/").split(/[?#]/u);
  const pathWithLeadingSlash = pathWithoutQueryOrHash.startsWith("/")
    ? pathWithoutQueryOrHash
    : `/${pathWithoutQueryOrHash}`;
  const normalizedPath = pathWithLeadingSlash.replace(/\/+$/u, "");

  return normalizedPath || "/";
}

export function isPublicTelemetryPath(pathname: string) {
  const normalizedPath = normalizePublicTelemetryPath(pathname);

  return !BLOCKED_PUBLIC_TELEMETRY_PATHS.has(normalizedPath) && !normalizedPath.startsWith("/admin/");
}

export function sanitizePublicTelemetryPageTitle(pathname: string, pageTitle: string) {
  return normalizePublicTelemetryPath(pathname) === "/search" ? "" : pageTitle;
}
