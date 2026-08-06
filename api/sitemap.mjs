const CONTENT_KINDS = ["news", "announcements", "blog"];
const SITEMAP_PAGE_SIZE = 100;

export const STATIC_INDEXABLE_ROUTES = [
  "/",
  "/news",
  "/announcements",
  "/achievements",
  "/departments",
  "/blog",
  "/documents",
  "/calendar",
  "/contact"
];

function trimTrailingSlash(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function hasProtocol(value) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

export function normalizeSiteUrl(value, fallback = "https://www.rcat.ac.th") {
  const normalized = trimTrailingSlash(value);
  if (!normalized) return normalizeSiteUrl(fallback, "");
  return hasProtocol(normalized) ? normalized : `https://${normalized}`;
}

function normalizeHostname(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeRoute(route) {
  if (route === "/") return "/";
  return `/${String(route || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(decodePathSegment(segment)))
    .join("/")}`;
}

export function normalizeInternalRoute(href, siteUrl) {
  const value = String(href || "").trim();
  if (!value || value.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(value)) {
    return "";
  }

  let url;
  let site;
  try {
    site = new URL(normalizeSiteUrl(siteUrl));
    url = new URL(value, `${site.origin}/`);
  } catch {
    return "";
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    normalizeHostname(url.hostname) !== normalizeHostname(site.hostname)
  ) {
    return "";
  }

  const pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/login" ||
    pathname === "/activate-account" ||
    pathname === "/reset-password" ||
    pathname === "/search" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  ) {
    return "";
  }

  return encodeRoute(pathname);
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function routeToUrl(siteUrl, route) {
  return route === "/" ? `${siteUrl}/` : `${siteUrl}${route}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isPublishedContent(item) {
  return Boolean(item?.slug) && item.status === "published";
}

function hasExternalCanonical(item, siteUrl) {
  const canonicalUrl = String(item?.canonicalUrl || "").trim();
  if (!/^https?:\/\//i.test(canonicalUrl)) return false;

  try {
    const site = new URL(normalizeSiteUrl(siteUrl));
    const canonical = new URL(canonicalUrl);
    return normalizeHostname(canonical.hostname) !== normalizeHostname(site.hostname);
  } catch {
    return false;
  }
}

export function getPublishedContentSitemapRoute(item, siteUrl) {
  if (!isPublishedContent(item) || hasExternalCanonical(item, siteUrl)) {
    return "";
  }

  const slug = normalizeSlug(item.slug);
  if (!slug) return "";

  const encodedSlug = slug
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(decodePathSegment(segment)))
    .join("/");

  return `/content/${encodedSlug}`;
}

export function buildSitemapUrls({ siteUrl, content = [] }) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const routes = new Set(STATIC_INDEXABLE_ROUTES);

  for (const item of content) {
    const route = getPublishedContentSitemapRoute(item, normalizedSiteUrl);
    if (route) routes.add(route);
  }

  return [...routes]
    .map((route) => routeToUrl(normalizedSiteUrl, route))
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function createSitemapXml(urls) {
  const entries = [...new Set(urls)].map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Public API returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.error || (Number.isFinite(payload?.statusCode) && payload.statusCode >= 400)) {
      throw new Error("Public API returned an application error");
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getSnapshotItems(snapshot) {
  return Array.isArray(snapshot?.items) ? snapshot.items : [];
}

function getSnapshotPageItems(snapshot) {
  return Array.isArray(snapshot?.pageItems) ? snapshot.pageItems : [];
}

async function loadAnnouncementSnapshot(baseUrl) {
  const getPage = (page) =>
    fetchJson(
      `${baseUrl}/api/public/content?kind=announcements&pagesPage=${page}&pagesPageSize=${SITEMAP_PAGE_SIZE}`
    );

  const firstSnapshot = await getPage(1);
  const totalPages = Math.max(1, Number(firstSnapshot?.pageItemsPagination?.totalPages) || 1);
  const remainingSnapshots =
    totalPages > 1 ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => getPage(index + 2))) : [];

  return {
    items: getSnapshotItems(firstSnapshot),
    pageItems: [firstSnapshot, ...remainingSnapshots].flatMap(getSnapshotPageItems)
  };
}

export async function loadSitemapData(apiBaseUrl) {
  const baseUrl = trimTrailingSlash(apiBaseUrl);
  if (!baseUrl) throw new Error("Cloudflare Public API URL is not configured");

  // Programs currently have a listing route (/departments) but no public detail route.
  // Only real content records may be emitted under the canonical /content/:slug namespace.
  const [newsSnapshot, announcementsSnapshot, blogSnapshot] = await Promise.all([
    fetchJson(`${baseUrl}/api/public/content?kind=${encodeURIComponent(CONTENT_KINDS[0])}`),
    loadAnnouncementSnapshot(baseUrl),
    fetchJson(`${baseUrl}/api/public/content?kind=${encodeURIComponent(CONTENT_KINDS[2])}`)
  ]);

  const content = [
    ...getSnapshotItems(newsSnapshot),
    ...announcementsSnapshot.items,
    ...announcementsSnapshot.pageItems,
    ...getSnapshotItems(blogSnapshot)
  ];

  return { content };
}

function inferSiteUrl(request) {
  const forwardedProto = String(request.headers?.["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();
  const forwardedHost = String(request.headers?.["x-forwarded-host"] || request.headers?.host || "")
    .split(",")[0]
    .trim();
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : "https://www.rcat.ac.th";
}

export default async function sitemap(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    response.status(405).end();
    return;
  }

  try {
    const siteUrl = normalizeSiteUrl(
      process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || inferSiteUrl(request)
    );
    const apiBaseUrl = process.env.CLOUDFLARE_PUBLIC_API_URL || process.env.VITE_CLOUDFLARE_PUBLIC_API_URL;

    const data = await loadSitemapData(apiBaseUrl);
    const urls = buildSitemapUrls({ siteUrl, content: data.content });
    const xml = createSitemapXml(urls);

    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.status(200);

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(xml);
  } catch (error) {
    console.error("Runtime sitemap generation failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Retry-After", "300");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    response.status(503).end("Sitemap is temporarily unavailable");
  }
}
