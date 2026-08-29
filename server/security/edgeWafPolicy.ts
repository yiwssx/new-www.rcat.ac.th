export const P6B_EDGE_WAF_MARKER = "p6b-vercel-v1";

const AUTH_MAX_BODY_BYTES = 16 * 1024;
const ADMIN_MAX_BODY_BYTES = 1024 * 1024;
const DENIED_METHODS = new Set(["CONNECT", "TRACE"]);

type EdgeWafDecision =
  | { action: "allow" }
  | { action: "deny"; status: 403 | 405 | 413; reason: "body-size" | "cross-site" | "internal-namespace" | "method" };

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function parseContentLength(request: Request) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return Number.NaN;
  return Number(raw);
}

function isCrossSiteRequest(request: Request, requestOrigin: string) {
  const fetchSite = (request.headers.get("sec-fetch-site") || "").trim().toLowerCase();
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin !== requestOrigin;
  } catch {
    return true;
  }
}

export function evaluateP6bEdgeWaf(request: Request): EdgeWafDecision {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (matchesPathPrefix(pathname, "/api/internal")) {
    return { action: "deny", status: 403, reason: "internal-namespace" };
  }

  const isCmsAuth = matchesPathPrefix(pathname, "/api/cms-auth");
  const isAdminProxy = matchesPathPrefix(pathname, "/api/admin-proxy");

  if (!isCmsAuth && !isAdminProxy) {
    return { action: "allow" };
  }

  if (DENIED_METHODS.has(request.method.toUpperCase())) {
    return { action: "deny", status: 405, reason: "method" };
  }

  if (isCrossSiteRequest(request, url.origin)) {
    return { action: "deny", status: 403, reason: "cross-site" };
  }

  const contentLength = parseContentLength(request);
  const maximumBytes = isCmsAuth ? AUTH_MAX_BODY_BYTES : ADMIN_MAX_BODY_BYTES;

  if (Number.isNaN(contentLength) || (contentLength !== null && contentLength > maximumBytes)) {
    return { action: "deny", status: 413, reason: "body-size" };
  }

  return { action: "allow" };
}
