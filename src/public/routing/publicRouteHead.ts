import { getPublicSiteUrl, projectSettings } from "../../config/projectSettings";
import { normalizePublicPageSearchValue } from "./searchParams";

export interface PublicRouteHeadInput {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  canonicalPath?: string;
  robots?: string;
  siteName?: string;
}

export interface StaticPublicRouteHead {
  title?: string;
  description: string;
  canonicalPath: string;
  robots?: string;
}

type PublicCanonicalPaginationKey = "page" | "announcementsPage" | "pagesPage";

const DEFAULT_PUBLIC_DESCRIPTION = "เว็บไซต์ประชาสัมพันธ์และระบบจัดการเนื้อหาของสถานศึกษา";

const PUBLIC_ROUTE_CANONICAL_PAGINATION_KEYS: Readonly<Record<string, readonly PublicCanonicalPaginationKey[]>> = {
  "/departments": ["page"],
  "/news": ["page"],
  "/announcements": ["announcementsPage", "pagesPage"],
  "/achievements": ["page"],
  "/blog": ["page"],
  "/documents": ["page"],
  "/calendar": ["page"]
};

export const STATIC_PUBLIC_ROUTE_HEADS: Readonly<Record<string, StaticPublicRouteHead>> = {
  "/": {
    description: DEFAULT_PUBLIC_DESCRIPTION,
    canonicalPath: "/"
  },
  "/news": {
    title: "ข่าว",
    description: "กิจกรรมล่าสุด เรื่องราวในสถานศึกษา และข่าวประชาสัมพันธ์จาก CMS",
    canonicalPath: "/news"
  },
  "/announcements": {
    title: "ประกาศ",
    description: "ประกาศราชการ ข้อมูลการรับสมัคร และเอกสารสาธารณะที่เผยแพร่โดยสถานศึกษา",
    canonicalPath: "/announcements"
  },
  "/achievements": {
    title: "ผลงานและความภาคภูมิใจ",
    description: "ผลงาน รางวัล และความสำเร็จของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
    canonicalPath: "/achievements"
  },
  "/blog": {
    title: "บทความ",
    description: "บทความและเนื้อหาระยะยาวที่เผยแพร่จาก CMS",
    canonicalPath: "/blog"
  },
  "/departments": {
    title: "หลักสูตร",
    description: "ข้อมูลหลักสูตรที่เผยแพร่จาก CMS",
    canonicalPath: "/departments"
  },
  "/documents": {
    title: "เอกสารเผยแพร่",
    description: "เอกสารเผยแพร่ของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
    canonicalPath: "/documents"
  },
  "/calendar": {
    title: "กำหนดการ",
    description: "กำหนดการและกิจกรรมสาธารณะของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
    canonicalPath: "/calendar"
  },
  "/contact": {
    title: "ติดต่อ",
    description: "ข้อมูลติดต่อที่เผยแพร่จาก CMS",
    canonicalPath: "/contact"
  },
  "/search": {
    title: "ค้นหา",
    description: "ค้นหาเนื้อหา ข่าว ประกาศ หลักสูตร และบทความในเว็บไซต์",
    canonicalPath: "/search",
    robots: "noindex,follow"
  }
};

function buildRouteDocumentTitle(title?: string, siteName?: string) {
  const normalizedTitle = title?.trim();
  const normalizedSiteName = siteName?.trim() || projectSettings.site.name;

  if (!normalizedTitle) {
    return normalizedSiteName;
  }

  if (normalizedTitle.includes(normalizedSiteName)) {
    return normalizedTitle;
  }

  return `${normalizedTitle} | ${normalizedSiteName}`;
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function hasProtocol(value: string) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function isLocalSiteUrl(value: string) {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:\d+)?$/i.test(value);
}

function getCanonicalBaseUrl(value = getPublicSiteUrl(), fallback = projectSettings.site.publicSiteUrl): string {
  const siteUrl = trimTrailingSlash(value || "");

  if (!siteUrl) {
    return fallback ? getCanonicalBaseUrl(fallback, "") : "https://example.edu";
  }

  if (isLocalSiteUrl(siteUrl) && fallback) {
    return getCanonicalBaseUrl(fallback, "");
  }

  if (hasProtocol(siteUrl)) {
    return siteUrl;
  }

  return `https://${siteUrl}`;
}

function resolveRouteCanonicalUrl(input: Pick<PublicRouteHeadInput, "canonicalUrl" | "canonicalPath">) {
  for (const candidate of [input.canonicalUrl, input.canonicalPath]) {
    const canonical = String(candidate || "").trim();
    const isInternalPath = canonical.startsWith("/") && !canonical.startsWith("//");
    const isHttpUrl = /^https?:\/\//i.test(canonical);

    if (!isInternalPath && !isHttpUrl) {
      continue;
    }

    try {
      return new URL(canonical, `${getCanonicalBaseUrl()}/`).toString();
    } catch {
      continue;
    }
  }

  return "";
}

function buildPaginatedCanonicalPath(pathname: string, search?: Record<string, unknown>) {
  const paginationKeys = PUBLIC_ROUTE_CANONICAL_PAGINATION_KEYS[pathname];

  if (!paginationKeys?.length || !search) {
    return pathname;
  }

  const canonicalSearch = new URLSearchParams();

  paginationKeys.forEach((key) => {
    const page = normalizePublicPageSearchValue(search[key]);

    if (page !== undefined) {
      canonicalSearch.set(key, String(page));
    }
  });

  const queryString = canonicalSearch.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildPublicRouteHead(input: PublicRouteHeadInput) {
  const title = buildRouteDocumentTitle(input.title, input.siteName);
  const description = input.description?.trim();
  const canonicalHref = resolveRouteCanonicalUrl(input);
  const robots = input.robots?.trim();

  return {
    meta: [
      { title },
      ...(description ? [{ name: "description", content: description }] : []),
      ...(robots ? [{ name: "robots", content: robots }] : [])
    ],
    links: canonicalHref ? [{ rel: "canonical", href: canonicalHref }] : []
  };
}

export function getRootRouteHead() {
  return buildPublicRouteHead({});
}

export function getStaticPublicRouteHead(pathname: string, search?: Record<string, unknown>) {
  const routeHead = STATIC_PUBLIC_ROUTE_HEADS[pathname] ?? { description: DEFAULT_PUBLIC_DESCRIPTION };

  return buildPublicRouteHead({
    ...routeHead,
    canonicalPath: routeHead.canonicalPath ? buildPaginatedCanonicalPath(routeHead.canonicalPath, search) : undefined
  });
}

export function getPublicContentRouteHead(slug: string) {
  const normalizedSlug = String(slug || "").trim();

  return buildPublicRouteHead({
    title: "เนื้อหา",
    description: "เนื้อหาที่เผยแพร่ต่อสาธารณะของสถานศึกษา",
    canonicalPath: normalizedSlug ? `/content/${normalizedSlug}` : undefined
  });
}

export function getCmsRouteHead() {
  return buildPublicRouteHead({
    title: "ระบบจัดการเนื้อหา",
    robots: "noindex,nofollow"
  });
}
