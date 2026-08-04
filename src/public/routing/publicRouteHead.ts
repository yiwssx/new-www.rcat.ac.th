import { projectSettings } from "../../config/projectSettings";
import type { PublicContentDetailSnapshot, SiteSettings } from "../../types";
import { normalizePublicPageSearchValue } from "./searchParams";
import {
  buildPublicBreadcrumbJsonLd,
  buildPublicContentJsonLd,
  buildPublicOrganizationJsonLd,
  buildPublicWebsiteJsonLd,
  getDefaultPublicSocialImageUrl,
  getPublicContentSocialImageUrl,
  getPublicSeoLocale,
  getPublicSeoSiteName,
  isPublicArticleContent,
  resolvePublicSeoUrl,
  serializePublicJsonLd
} from "./publicSeo";

export interface PublicStructuredDataEntry {
  id: string;
  data: unknown;
}

export interface PublicRouteHeadInput {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  canonicalPath?: string;
  robots?: string;
  siteName?: string;
  imageUrl?: string;
  imageAlt?: string;
  ogType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  social?: boolean;
  structuredData?: readonly PublicStructuredDataEntry[];
}

export interface StaticPublicRouteHead {
  title?: string;
  description: string;
  canonicalPath: string;
  robots?: string;
}

export interface PublicRouteHeadContextData {
  loaderData?: unknown;
  matches?: readonly { loaderData?: unknown }[];
}

type PublicCanonicalPaginationKey = "page" | "announcementsPage" | "pagesPage";

const DEFAULT_PUBLIC_DESCRIPTION = "เว็บไซต์ประชาสัมพันธ์และระบบจัดการเนื้อหาของสถานศึกษา";
const DEFAULT_CONTENT_DESCRIPTION = "เนื้อหาที่เผยแพร่ต่อสาธารณะของสถานศึกษา";

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

const PUBLIC_CONTENT_ARCHIVE: Readonly<Record<string, { name: string; path: string } | undefined>> = {
  news: { name: "ข่าว", path: "/news" },
  announcement: { name: "ประกาศ", path: "/announcements" },
  blog: { name: "บทความ", path: "/blog" },
  program: { name: "หลักสูตร", path: "/departments" },
  page: undefined
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSiteSettings(value: unknown): SiteSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (isRecord(value.siteSettings)) {
    return value.siteSettings as unknown as SiteSettings;
  }

  return undefined;
}

function getContextSiteSettings(context?: PublicRouteHeadContextData) {
  const direct = readSiteSettings(context?.loaderData);
  if (direct) {
    return direct;
  }

  const matches = context?.matches || [];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const siteSettings = readSiteSettings(matches[index]?.loaderData);
    if (siteSettings) {
      return siteSettings;
    }
  }

  return undefined;
}

function readContentDetailSnapshot(value: unknown): PublicContentDetailSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.item) || !Array.isArray(value.media) || typeof value.generatedAt !== "string") {
    return undefined;
  }

  return value as unknown as PublicContentDetailSnapshot;
}

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

function getHomeDescription(siteSettings?: SiteSettings) {
  return siteSettings?.heroDescription?.trim() || siteSettings?.intro?.trim() || DEFAULT_PUBLIC_DESCRIPTION;
}

function getStaticRoutePresentation(pathname: string, search?: Record<string, unknown>) {
  const routeHead = STATIC_PUBLIC_ROUTE_HEADS[pathname] ?? { description: DEFAULT_PUBLIC_DESCRIPTION };

  if (pathname !== "/search") {
    return routeHead;
  }

  const query = String(search?.q || "").trim();
  if (!query) {
    return routeHead;
  }

  return {
    ...routeHead,
    title: `ผลการค้นหา “${query}”`,
    description: `ผลการค้นหาเนื้อหาสาธารณะสำหรับ “${query}”`
  };
}

function createStructuredDataScripts(entries: readonly PublicStructuredDataEntry[] | undefined) {
  return (entries || []).map((entry) => ({
    id: entry.id,
    type: "application/ld+json",
    children: serializePublicJsonLd(entry.data)
  }));
}

export function buildPublicRouteHead(input: PublicRouteHeadInput) {
  const title = buildRouteDocumentTitle(input.title, input.siteName);
  const description = input.description?.trim();
  const canonicalHref = resolvePublicSeoUrl(input.canonicalUrl || input.canonicalPath);
  const robots = input.robots?.trim();
  const social = input.social !== false;
  const imageUrl = resolvePublicSeoUrl(input.imageUrl);
  const siteName = input.siteName?.trim() || projectSettings.site.name;
  const ogType = input.ogType || "website";

  return {
    meta: [
      { title },
      ...(description ? [{ name: "description", content: description }] : []),
      ...(robots ? [{ name: "robots", content: robots }] : []),
      ...(social
        ? [
            { property: "og:title", content: title },
            ...(description ? [{ property: "og:description", content: description }] : []),
            { property: "og:type", content: ogType },
            { property: "og:site_name", content: siteName },
            { property: "og:locale", content: getPublicSeoLocale() },
            ...(canonicalHref ? [{ property: "og:url", content: canonicalHref }] : []),
            ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
            ...(imageUrl && input.imageAlt ? [{ property: "og:image:alt", content: input.imageAlt }] : []),
            { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" },
            { name: "twitter:title", content: title },
            ...(description ? [{ name: "twitter:description", content: description }] : []),
            ...(imageUrl ? [{ name: "twitter:image", content: imageUrl }] : []),
            ...(input.publishedTime ? [{ property: "article:published_time", content: input.publishedTime }] : []),
            ...(input.modifiedTime ? [{ property: "article:modified_time", content: input.modifiedTime }] : []),
            ...(input.section ? [{ property: "article:section", content: input.section }] : [])
          ]
        : [])
    ],
    links: canonicalHref ? [{ rel: "canonical", href: canonicalHref }] : [],
    scripts: createStructuredDataScripts(input.structuredData)
  };
}

export function getRootRouteHead() {
  return buildPublicRouteHead({
    social: false
  });
}

export function getPublicLayoutRouteHead(loaderData?: unknown) {
  const siteSettings = readSiteSettings(loaderData);
  const siteName = getPublicSeoSiteName(siteSettings);
  const description = getHomeDescription(siteSettings);

  return buildPublicRouteHead({
    siteName,
    description,
    imageUrl: getDefaultPublicSocialImageUrl(siteSettings),
    imageAlt: siteName,
    structuredData: [
      {
        id: "rcat-organization-jsonld",
        data: buildPublicOrganizationJsonLd(siteSettings)
      }
    ]
  });
}

export function getStaticPublicRouteHead(
  pathname: string,
  search?: Record<string, unknown>,
  context?: PublicRouteHeadContextData
) {
  const routeHead = getStaticRoutePresentation(pathname, search);
  const siteSettings = getContextSiteSettings(context);
  const siteName = getPublicSeoSiteName(siteSettings);
  const canonicalPath = routeHead.canonicalPath
    ? buildPaginatedCanonicalPath(routeHead.canonicalPath, search)
    : undefined;
  const description = pathname === "/" ? getHomeDescription(siteSettings) : routeHead.description;
  const structuredData: PublicStructuredDataEntry[] = [];

  if (pathname === "/") {
    structuredData.push({
      id: "rcat-website-jsonld",
      data: buildPublicWebsiteJsonLd(siteSettings, description)
    });
  } else if (routeHead.canonicalPath && routeHead.title) {
    structuredData.push({
      id: "rcat-breadcrumb-jsonld",
      data: buildPublicBreadcrumbJsonLd([
        { name: "หน้าหลัก", path: "/" },
        { name: routeHead.title, path: canonicalPath || routeHead.canonicalPath }
      ])
    });
  }

  return buildPublicRouteHead({
    ...routeHead,
    title: routeHead.title,
    description,
    canonicalPath,
    siteName,
    imageUrl: getDefaultPublicSocialImageUrl(siteSettings),
    imageAlt: siteName,
    structuredData
  });
}

export function getPublicContentRouteHead(
  slug: string,
  loaderData?: unknown,
  context?: PublicRouteHeadContextData
) {
  const normalizedSlug = String(slug || "").trim();
  const snapshot = readContentDetailSnapshot(loaderData);
  const siteSettings = getContextSiteSettings({
    loaderData: context?.loaderData,
    matches: context?.matches
  });

  if (!snapshot) {
    return buildPublicRouteHead({
      title: "เนื้อหา",
      description: DEFAULT_CONTENT_DESCRIPTION,
      canonicalPath: normalizedSlug ? `/content/${normalizedSlug}` : undefined,
      siteName: getPublicSeoSiteName(siteSettings),
      imageUrl: getDefaultPublicSocialImageUrl(siteSettings),
      imageAlt: getPublicSeoSiteName(siteSettings)
    });
  }

  const { item } = snapshot;
  const contentSlug = item.slug?.trim() || normalizedSlug;
  const internalContentPath = contentSlug ? `/content/${contentSlug}` : undefined;
  const canonicalUrl = resolvePublicSeoUrl(item.canonicalUrl || internalContentPath);
  const description = item.seoDescription?.trim() || item.summary?.trim() || DEFAULT_CONTENT_DESCRIPTION;
  const title = item.seoTitle?.trim() || item.title?.trim() || "เนื้อหา";
  const imageUrl = getPublicContentSocialImageUrl(snapshot, siteSettings);
  const archive = PUBLIC_CONTENT_ARCHIVE[item.type];
  const breadcrumbs = [
    { name: "หน้าหลัก", path: "/" },
    ...(archive ? [archive] : []),
    ...(internalContentPath ? [{ name: item.title, path: internalContentPath }] : [])
  ];
  const structuredData: PublicStructuredDataEntry[] = [
    {
      id: "rcat-content-jsonld",
      data: buildPublicContentJsonLd({
        snapshot,
        siteSettings,
        canonicalUrl: canonicalUrl || resolvePublicSeoUrl(internalContentPath),
        description,
        imageUrl
      })
    }
  ];

  if (breadcrumbs.length > 1) {
    structuredData.push({
      id: "rcat-breadcrumb-jsonld",
      data: buildPublicBreadcrumbJsonLd(breadcrumbs)
    });
  }

  return buildPublicRouteHead({
    title,
    description,
    canonicalUrl: canonicalUrl || internalContentPath,
    siteName: getPublicSeoSiteName(siteSettings),
    imageUrl,
    imageAlt: item.title,
    ogType: isPublicArticleContent(item) ? "article" : "website",
    publishedTime: isPublicArticleContent(item) ? item.publishAt : undefined,
    modifiedTime: isPublicArticleContent(item) ? item.updatedAt : undefined,
    section: isPublicArticleContent(item) ? item.category : undefined,
    structuredData
  });
}

export function getCmsRouteHead() {
  return buildPublicRouteHead({
    title: "ระบบจัดการเนื้อหา",
    robots: "noindex,nofollow",
    social: false
  });
}
