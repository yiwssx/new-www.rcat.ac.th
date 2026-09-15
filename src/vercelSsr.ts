import { renderSsrResponse } from "./entry-server";
import { finalizeSlug } from "./utils/slug";

export const SSR_REWRITE_PATH_PARAM = "_rcatPath";
export const PUBLIC_SSR_BROWSER_CACHE_CONTROL = "public, max-age=0, must-revalidate";
export const PUBLIC_HOME_SSR_CDN_CACHE_CONTROL = "public, max-age=60";
export const PUBLIC_SSR_CDN_CACHE_CONTROL = "public, max-age=600, stale-while-revalidate=3600";
export const PUBLIC_REDIRECT_CDN_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
export const PUBLIC_NOT_FOUND_CDN_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

const STATIC_PUBLIC_SSR_PATHS = new Set([
  "/",
  "/news",
  "/announcements",
  "/achievements",
  "/blog",
  "/departments",
  "/documents",
  "/calendar",
  "/contact",
  "/complaint",
  "/ita2569",
  "/search"
]);

const RESERVED_SINGLE_SEGMENT_PATHS = new Set([
  "/admin",
  "/api",
  "/login",
  "/activate-account",
  "/reset-password",
  "/sitemap.xml",
  "/robots.txt"
]);

const BLOCKED_LEGACY_PERMALINK_PATHS = new Set(["/ip", "/null", "/undefined"]);
const LEGACY_FILE_PROBE_PATTERN = /\.(?:asp|aspx|bak|cgi|css|env|git|gz|ico|ini|js|json|map|php|sql|tar|txt|xml|zip)$/i;
const MAX_LEGACY_SLUG_LENGTH = 160;

function normalizeRewritePath(value: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/") || normalized.includes("?") || normalized.includes("#")) {
    return "";
  }

  return normalized.replace(/\/{2,}/g, "/");
}

function isLegacyPermalinkPath(pathname: string) {
  return (
    /^\/[^/]+$/.test(pathname) && !STATIC_PUBLIC_SSR_PATHS.has(pathname) && !RESERVED_SINGLE_SEGMENT_PATHS.has(pathname)
  );
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function shouldRejectLegacyPermalink(pathname: string) {
  if (BLOCKED_LEGACY_PERMALINK_PATHS.has(pathname)) {
    return true;
  }

  const segment = pathname.slice(1);
  if (
    !segment ||
    segment.length > MAX_LEGACY_SLUG_LENGTH ||
    segment.startsWith(".") ||
    LEGACY_FILE_PROBE_PATTERN.test(segment)
  ) {
    return true;
  }

  const decodedSegment = decodePathSegment(segment);
  return !decodedSegment || decodedSegment !== finalizeSlug(decodedSegment);
}

export function isPublicSsrPath(pathname: string) {
  if (STATIC_PUBLIC_SSR_PATHS.has(pathname)) {
    return true;
  }

  if (/^\/content\/[^/]+$/.test(pathname)) {
    return true;
  }

  return isLegacyPermalinkPath(pathname);
}

export function reconstructPublicSsrRequest(request: Request) {
  const rewrittenUrl = new URL(request.url);
  const pathname = normalizeRewritePath(rewrittenUrl.searchParams.get(SSR_REWRITE_PATH_PARAM));

  if (!pathname || !isPublicSsrPath(pathname)) {
    return null;
  }

  const originalUrl = new URL(pathname, rewrittenUrl.origin);
  rewrittenUrl.searchParams.forEach((value, key) => {
    if (key !== SSR_REWRITE_PATH_PARAM) {
      originalUrl.searchParams.append(key, value);
    }
  });

  return new Request(originalUrl, {
    method: request.method,
    headers: request.headers,
    signal: request.signal
  });
}

function withResponseHeaders(response: Response, headers: Headers, body: BodyInit | null = response.body) {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function applyVercelPublicSsrCachePolicy(request: Request, response: Response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  const isDynamicContentDetail = /^\/content\/[^/]+$/.test(url.pathname);

  if (response.status === 200 && isDynamicContentDetail) {
    headers.set("Cache-Control", "no-store");
    headers.delete("Vercel-CDN-Cache-Control");
  } else if (response.status === 200 && url.pathname === "/") {
    headers.set("Cache-Control", PUBLIC_SSR_BROWSER_CACHE_CONTROL);
    headers.set("Vercel-CDN-Cache-Control", PUBLIC_HOME_SSR_CDN_CACHE_CONTROL);
  } else if (response.status === 200 && url.pathname !== "/search") {
    headers.set("Cache-Control", PUBLIC_SSR_BROWSER_CACHE_CONTROL);
    headers.set("Vercel-CDN-Cache-Control", PUBLIC_SSR_CDN_CACHE_CONTROL);
  } else if (response.status >= 300 && response.status < 400) {
    headers.set("Cache-Control", PUBLIC_SSR_BROWSER_CACHE_CONTROL);
    headers.set("Vercel-CDN-Cache-Control", PUBLIC_REDIRECT_CDN_CACHE_CONTROL);
  } else if (response.status === 404) {
    headers.set("Cache-Control", PUBLIC_SSR_BROWSER_CACHE_CONTROL);
    headers.set("Vercel-CDN-Cache-Control", PUBLIC_NOT_FOUND_CDN_CACHE_CONTROL);
    headers.set("X-Robots-Tag", "noindex, nofollow");
  } else {
    headers.set("Cache-Control", "no-store");
    headers.delete("Vercel-CDN-Cache-Control");
  }

  return withResponseHeaders(response, headers);
}

function createUnavailableResponse() {
  return new Response("Service Unavailable", {
    status: 503,
    statusText: "Service Unavailable",
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "300",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

function createMethodNotAllowedResponse() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "GET, HEAD",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

function createInvalidRewriteResponse() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

function createPublicNotFoundResponse() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

async function resolveLegacyPermalinkResponse(request: Request) {
  const url = new URL(request.url);
  if (!isLegacyPermalinkPath(url.pathname)) {
    return null;
  }

  if (shouldRejectLegacyPermalink(url.pathname)) {
    return createPublicNotFoundResponse();
  }

  const slug = decodePathSegment(url.pathname.slice(1));
  const { getPublicContentDetailSnapshot, isPublicContentNotFoundError } =
    await import("./features/public-content/api");

  try {
    await getPublicContentDetailSnapshot({ slug }, { signal: request.signal });
  } catch (error) {
    if (isPublicContentNotFoundError(error)) {
      return createPublicNotFoundResponse();
    }
    throw error;
  }

  return new Response(null, {
    status: 301,
    headers: {
      Location: `/content/${encodeURIComponent(slug)}`
    }
  });
}

export async function renderVercelPublicSsrRequest(request: Request) {
  const publicRequest = reconstructPublicSsrRequest(request);
  if (!publicRequest) {
    return createInvalidRewriteResponse();
  }

  const legacyPermalinkResponse = await resolveLegacyPermalinkResponse(publicRequest);
  const rendered = legacyPermalinkResponse ?? (await renderSsrResponse(publicRequest));
  const cached = applyVercelPublicSsrCachePolicy(publicRequest, rendered);

  if (request.method === "HEAD") {
    return withResponseHeaders(cached, new Headers(cached.headers), null);
  }

  return cached;
}

export async function handleVercelPublicSsrRequest(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return createMethodNotAllowedResponse();
  }

  try {
    return await renderVercelPublicSsrRequest(request);
  } catch (error) {
    console.error("Public SSR render failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return createUnavailableResponse();
  }
}
