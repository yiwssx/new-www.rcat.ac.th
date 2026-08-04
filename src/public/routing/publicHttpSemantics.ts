export const PUBLIC_ROUTE_FAILURE_MARKER = "rcat-public-route-upstream-failure" as const;
export const PUBLIC_UPSTREAM_RETRY_AFTER_SECONDS = 300;

export interface PublicRouteLoadFailure {
  __rcatPublicRouteFailure: typeof PUBLIC_ROUTE_FAILURE_MARKER;
  status: 503;
  retryAfterSeconds: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createPublicRouteLoadFailure(): PublicRouteLoadFailure {
  return {
    __rcatPublicRouteFailure: PUBLIC_ROUTE_FAILURE_MARKER,
    status: 503,
    retryAfterSeconds: PUBLIC_UPSTREAM_RETRY_AFTER_SECONDS
  };
}

export function isPublicRouteLoadFailure(value: unknown): value is PublicRouteLoadFailure {
  return (
    isRecord(value) &&
    value.__rcatPublicRouteFailure === PUBLIC_ROUTE_FAILURE_MARKER &&
    value.status === 503
  );
}

export function hasPublicRouteLoadFailure(matches: readonly unknown[]) {
  return matches.some((match) => isRecord(match) && isPublicRouteLoadFailure(match.loaderData));
}

function getIndexingDirective(pathname: string, status: number) {
  if (status >= 400) {
    return "noindex, nofollow";
  }

  if (pathname === "/search" || pathname.startsWith("/search/")) {
    return "noindex, follow";
  }

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login" ||
    pathname === "/activate-account" ||
    pathname === "/reset-password"
  ) {
    return "noindex, nofollow";
  }

  return "";
}

export function applyPublicSsrHttpSemantics(input: {
  request: Request;
  response: Response;
  matches: readonly unknown[];
}) {
  const requestUrl = new URL(input.request.url);
  const upstreamUnavailable = hasPublicRouteLoadFailure(input.matches);
  const status = input.response.status === 200 && upstreamUnavailable ? 503 : input.response.status;
  const headers = new Headers(input.response.headers);
  const indexingDirective = getIndexingDirective(requestUrl.pathname, status);

  if (indexingDirective) {
    headers.set("X-Robots-Tag", indexingDirective);
  }

  if (status >= 400) {
    headers.set("Cache-Control", "no-store");
  }

  if (status === 503) {
    headers.set("Retry-After", String(PUBLIC_UPSTREAM_RETRY_AFTER_SECONDS));
  }

  if (status === input.response.status) {
    return new Response(input.response.body, {
      status,
      statusText: input.response.statusText,
      headers
    });
  }

  return new Response(input.response.body, {
    status,
    statusText: status === 503 ? "Service Unavailable" : input.response.statusText,
    headers
  });
}
