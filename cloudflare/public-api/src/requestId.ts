import type { Env } from "./env";

export const RCAT_REQUEST_ID_HEADER = "X-RCAT-Request-ID";

const CMS_PROXY_SECRET_HEADER = "X-RCAT-CMS-Auth-Proxy-Secret";
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isValidRequestId(value: string | null | undefined) {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

function canAcceptUpstreamRequestId(request: Request, env: Env) {
  const pathname = getSafeRequestPathname(request);
  const configuredProxySecret = env.CMS_AUTH_PROXY_SECRET?.trim() ?? "";
  const requestProxySecret = request.headers.get(CMS_PROXY_SECRET_HEADER) ?? "";

  return (
    (pathname.startsWith("/api/admin/") || pathname.startsWith("/api/internal/cms-auth/")) &&
    configuredProxySecret.length > 0 &&
    requestProxySecret === configuredProxySecret
  );
}

export function resolveRequestId(request: Request, env: Env) {
  const incoming = request.headers.get(RCAT_REQUEST_ID_HEADER);

  if (canAcceptUpstreamRequestId(request, env) && isValidRequestId(incoming)) {
    return incoming!.toLowerCase();
  }

  return crypto.randomUUID();
}

export function withRequestId(response: Response, requestId: string) {
  const headers = new Headers(response.headers);
  headers.set(RCAT_REQUEST_ID_HEADER, requestId);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}

export function getSafeRequestPathname(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/invalid-request-url";
  }
}

export function logUnhandledWorkerError(request: Request, requestId: string, error: unknown) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "worker_unhandled_error",
      component: "public-api-worker",
      requestId,
      method: request.method.toUpperCase(),
      pathname: getSafeRequestPathname(request),
      errorName: error instanceof Error && error.name ? error.name : "Error"
    })
  );
}
