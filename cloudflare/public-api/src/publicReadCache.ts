import type { Env } from "./env";

const DEFAULT_PUBLIC_READ_TTL_SECONDS = 300;
const VISITOR_STATS_TTL_SECONDS = 120;
const SEARCH_TTL_SECONDS = 120;

export type PublicReadCacheStatus = "HIT" | "MISS" | "BYPASS";

function getPublicReadCacheTtlSeconds(request: Request) {
  if (request.method !== "GET") {
    return 0;
  }

  const { pathname } = new URL(request.url);

  if (pathname === "/api/public/visitor-stats") {
    return VISITOR_STATS_TTL_SECONDS;
  }

  if (pathname === "/api/public/search") {
    return SEARCH_TTL_SECONDS;
  }

  if (
    pathname === "/api/public/home" ||
    pathname === "/api/public/shell" ||
    pathname === "/api/public/documents" ||
    pathname === "/api/public/events" ||
    pathname === "/api/public/content" ||
    pathname === "/api/public/programs"
  ) {
    return DEFAULT_PUBLIC_READ_TTL_SECONDS;
  }

  return 0;
}

function requestBypassesCache(request: Request) {
  const cacheControl = request.headers.get("Cache-Control")?.toLowerCase() ?? "";
  const pragma = request.headers.get("Pragma")?.toLowerCase() ?? "";

  return cacheControl.includes("no-cache") || cacheControl.includes("no-store") || pragma.includes("no-cache");
}

function getDefaultCache() {
  return typeof caches === "undefined" ? null : caches.default;
}

function createCacheKey(request: Request) {
  return new Request(request.url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });
}

export function isPublicReadCacheEligible(request: Request, env: Env) {
  return (
    env.ENVIRONMENT === "production" && !requestBypassesCache(request) && getPublicReadCacheTtlSeconds(request) > 0
  );
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

export function storePublicReadCache(
  request: Request,
  env: Env,
  response: Response,
  context?: ExecutionContext
) {
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
