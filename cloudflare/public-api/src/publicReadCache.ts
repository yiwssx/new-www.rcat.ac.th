import type { Env } from "./env";

const DEFAULT_PUBLIC_READ_TTL_SECONDS = 300;
const HOME_PUBLIC_READ_TTL_SECONDS = 15 * 60;
const VISITOR_STATS_TTL_SECONDS = 5 * 60;
const SEARCH_TTL_SECONDS = 5 * 60;

export type PublicReadCacheStatus = "HIT" | "MISS" | "BYPASS";

function getPublicReadCacheTtlSeconds(request: Request) {
  if (request.method !== "GET") {
    return 0;
  }

  const { pathname } = new URL(request.url);

  if (pathname === "/api/public/home" || pathname === "/api/public/shell" || pathname === "/api/public/programs") {
    return HOME_PUBLIC_READ_TTL_SECONDS;
  }

  if (pathname === "/api/public/visitor-stats") {
    return VISITOR_STATS_TTL_SECONDS;
  }

  if (pathname === "/api/public/search") {
    return SEARCH_TTL_SECONDS;
  }

  if (pathname === "/api/public/documents" || pathname === "/api/public/events" || pathname === "/api/public/content") {
    return DEFAULT_PUBLIC_READ_TTL_SECONDS;
  }

  return 0;
}

function getDefaultCache() {
  return typeof caches === "undefined" ? null : caches.default;
}

function positiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function boundedPageSize(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 100) : fallback;
}

function createCanonicalSearchUrl(url: URL) {
  const canonical = new URL(url.origin + url.pathname);
  const query = (url.searchParams.get("q") ?? "").trim();
  const page = positiveInteger(url.searchParams.get("page"));

  if (query) {
    canonical.searchParams.set("q", query);
  }

  if (page !== null) {
    canonical.searchParams.set("page", String(page));
    canonical.searchParams.set("pageSize", String(boundedPageSize(url.searchParams.get("pageSize"), 20)));
  }

  return canonical;
}

function createCanonicalContentUrl(url: URL) {
  const canonical = new URL(url.origin + url.pathname);
  const kind = (url.searchParams.get("kind") ?? "news").trim().toLowerCase() || "news";
  const page = positiveInteger(url.searchParams.get("page"));

  canonical.searchParams.set("kind", kind);

  if (page !== null) {
    canonical.searchParams.set("page", String(page));
    canonical.searchParams.set("pageSize", String(boundedPageSize(url.searchParams.get("pageSize"), 20)));
  }

  if (kind === "announcements") {
    canonical.searchParams.set("pagesPage", String(positiveInteger(url.searchParams.get("pagesPage")) ?? 1));
    canonical.searchParams.set("pagesPageSize", String(boundedPageSize(url.searchParams.get("pagesPageSize"), 12)));
  }

  return canonical;
}

function createCacheKey(request: Request) {
  const url = new URL(request.url);
  let canonicalUrl: URL;

  if (url.pathname === "/api/public/search") {
    canonicalUrl = createCanonicalSearchUrl(url);
  } else if (url.pathname === "/api/public/content") {
    canonicalUrl = createCanonicalContentUrl(url);
  } else {
    // These public endpoints do not consume query parameters. Ignoring arbitrary
    // client parameters prevents cache-busting traffic from reaching D1.
    canonicalUrl = new URL(url.origin + url.pathname);
  }

  return new Request(canonicalUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });
}

export function isPublicReadCacheEligible(request: Request, env: Env) {
  // Production public callers cannot opt out of the shared cache with request
  // Cache-Control/Pragma headers. Allowing that would turn a hard refresh or bot
  // into a direct D1 cache-bypass primitive.
  return env.ENVIRONMENT === "production" && getPublicReadCacheTtlSeconds(request) > 0;
}

export async function readPublicReadCache(request: Request, env: Env): Promise<Response | null> {
  if (!isPublicReadCacheEligible(request, env)) {
    return null;
  }

  const cache = getDefaultCache();
  if (!cache) {
    return null;
  }

  return (await cache.match(createCacheKey(request))) ?? null;
}

export function storePublicReadCache(request: Request, env: Env, response: Response, context?: ExecutionContext) {
  const ttlSeconds = getPublicReadCacheTtlSeconds(request);

  if (!isPublicReadCacheEligible(request, env) || ttlSeconds <= 0 || response.status !== 200) {
    return;
  }

  const cache = getDefaultCache();
  if (!cache) {
    return;
  }

  const cachedResponse = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
  cachedResponse.headers.set("Cache-Control", `public, s-maxage=${ttlSeconds}`);

  const write = cache.put(createCacheKey(request), cachedResponse).catch((error) => {
    console.warn("public read cache write failed", error);
  });

  if (context) {
    context.waitUntil(write);
  }
}

export function withPublicReadCacheStatus(response: Response, status: PublicReadCacheStatus) {
  const headers = new Headers(response.headers);
  headers.set("X-RCAT-Public-Cache", status);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
