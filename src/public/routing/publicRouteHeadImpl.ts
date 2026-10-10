import { projectSettings } from "../../config/projectSettings";
import type { PublicOrganizationDetail } from "../../features/public-organization";
import type { ContentItem, MediaAsset, SiteSettings } from "../../types";
import { getPublicRouteMetadata, PUBLIC_ROUTE_REGISTRY } from "./publicRouteRegistry";
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

interface PublicContentHeadLoaderData {
  item: ContentItem;
  siteSettings?: SiteSettings;
  featuredMedia?: MediaAsset;
}

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

export const STATIC_PUBLIC_ROUTE_HEADS: Readonly<Record<string, StaticPublicRouteHead>> = Object.freeze(
  Object.fromEntries(
    PUBLIC_ROUTE_REGISTRY.map((route) => [
      route.path,
      {
        ...(route.title ? { title: route.title } : {}),
        description: route.description || DEFAULT_PUBLIC_DESCRIPTION,
        canonicalPath: route.path,
        ...(route.robots ? { robots: route.robots } : {})
      }
    ])
  ) as Record<string, StaticPublicRouteHead>
);

const PUBLIC_CONTENT_ARCHIVE: Readonly<Record<string, { name: string; path: string } | undefined>> = {
  news: { name: "ข่าว", path: "/news" },
  announcement: { name: "ประกาศ", path: "/announcements" },
  blog: { name: "บทความ", path: "/blog" },
  program: { name: "แผนกวิชา", path: "/departments" },
  page: undefined
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSiteSettings(value: unknown): SiteSettings | undefined {
  if (!isRecord(value) || !isRecord(value.siteSettings)) {
    return undefined;
  }

  return value.siteSettings as unknown as SiteSettings;
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

function readContentHeadLoaderData(value: unknown): PublicContentHeadLoaderData | undefined {
  if (!isRecord(value) || !isRecord(value.item)) {
    return undefined;
  }

  return {
    item: value.item as unknown as ContentItem,
    siteSettings: isRecord(value.siteSettings) ? (value.siteSettings as unknown as SiteSettings) : undefined,
    featuredMedia: isRecord(value.featuredMedia) ? (value.featuredMedia as unknown as MediaAsset) : undefined
  };
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
  const registeredRoute = getPublicRouteMetadata(pathname);
  const routeHead = registeredRoute
    ? STATIC_PUBLIC_ROUTE_HEADS[registeredRoute.path]
    : { description: DEFAULT_PUBLIC_DESCRIPTION, canonicalPath: pathname };

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
  const explicitSiteName = input.siteName?.trim();
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
            ...(explicitSiteName ? [{ property: "og:site_name", content: explicitSiteName }] : []),
            { property: "og:locale", content: getPublicSeoLocale() },
            ...(canonicalHref ? [{ property: "og:url", content: canonicalHref }] : []),
            ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
            ...(imageUrl && input.imageAlt ? [{ property: "og:image:alt", content: input.imageAlt }] : []),
            ...(imageUrl ? [{ name: "twitter:card", content: "summary_large_image" }] : []),
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
  return buildPublicRouteHead({ social: false });
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
    siteName: siteSettings ? getPublicSeoSiteName(siteSettings) : undefined,
    imageUrl: siteSettings ? getDefaultPublicSocialImageUrl(siteSettings) : undefined,
    imageAlt: siteSettings ? getPublicSeoSiteName(siteSettings) : undefined,
    structuredData
  });
}

export function getPublicContentRouteHead(slug: string, loaderData?: unknown, context?: PublicRouteHeadContextData) {
  const normalizedSlug = String(slug || "").trim();
  const detailData = readContentHeadLoaderData(loaderData);
  const siteSettings = detailData?.siteSettings || getContextSiteSettings(context);

  if (!detailData) {
    return buildPublicRouteHead({
      title: "เนื้อหา",
      description: DEFAULT_CONTENT_DESCRIPTION,
      canonicalPath: normalizedSlug ? `/content/${normalizedSlug}` : undefined,
      siteName: siteSettings ? getPublicSeoSiteName(siteSettings) : undefined,
      imageUrl: siteSettings ? getDefaultPublicSocialImageUrl(siteSettings) : undefined,
      imageAlt: siteSettings ? getPublicSeoSiteName(siteSettings) : undefined
    });
  }

  const { item } = detailData;
  const contentSlug = item.slug?.trim() || normalizedSlug;
  const internalContentPath = contentSlug ? `/content/${contentSlug}` : undefined;
  const canonicalUrl = resolvePublicSeoUrl(item.canonicalUrl || internalContentPath);
  const description = item.seoDescription?.trim() || item.summary?.trim() || DEFAULT_CONTENT_DESCRIPTION;
  const title = item.seoTitle?.trim() || item.title?.trim() || "เนื้อหา";
  const imageUrl = getPublicContentSocialImageUrl(detailData.featuredMedia, siteSettings);
  const archive = PUBLIC_CONTENT_ARCHIVE[item.type];
  const breadcrumbs = [
    { name: "หน้าหลัก", path: "/" },
    ...(archive ? [archive] : []),
    ...(internalContentPath ? [{ name: item.title, path: internalContentPath }] : [])
  ];
  const resolvedCanonical = canonicalUrl || resolvePublicSeoUrl(internalContentPath);
  const structuredData: PublicStructuredDataEntry[] = [
    {
      id: "rcat-content-jsonld",
      data: buildPublicContentJsonLd({
        item,
        siteSettings,
        canonicalUrl: resolvedCanonical,
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
    canonicalUrl: resolvedCanonical || internalContentPath,
    siteName: siteSettings ? getPublicSeoSiteName(siteSettings) : undefined,
    imageUrl,
    imageAlt: item.title,
    ogType: isPublicArticleContent(item) ? "article" : "website",
    publishedTime: isPublicArticleContent(item) ? item.publishAt : undefined,
    modifiedTime: isPublicArticleContent(item) ? item.updatedAt : undefined,
    section: isPublicArticleContent(item) ? item.category : undefined,
    structuredData
  });
}

/** Head metadata is computed only from publicly visible Worker data. */
export function getPublicOrganizationRouteHead(
  _slug: string,
  loaderData?: unknown,
  context?: PublicRouteHeadContextData
) {
  const siteSettings = getContextSiteSettings(context);
  const valid =
    isRecord(loaderData) &&
    isRecord(loaderData.unit) &&
    typeof loaderData.unit.title === "string" &&
    typeof loaderData.unit.slug === "string" &&
    Array.isArray(loaderData.ancestors);
  if (!valid) {
    return buildPublicRouteHead({ title: "ผังองค์กร", robots: "noindex, nofollow", social: false });
  }
  const detail = loaderData as unknown as PublicOrganizationDetail;
  const unit = detail.unit;
  const canonicalPath = `/organization/${encodeURIComponent(unit.slug)}`;
  const description = unit.summary.trim() || `โครงสร้างหน่วยงานและบุคลากรของ${unit.title}`;
  const breadcrumbs = [
    { name: "หน้าหลัก", path: "/" },
    ...detail.ancestors.map((ancestor) => ({
      name: ancestor.title,
      path: `/organization/${encodeURIComponent(ancestor.slug)}`
    })),
    { name: unit.title, path: canonicalPath }
  ];
  return buildPublicRouteHead({
    title: unit.title,
    description,
    canonicalPath,
    siteName: siteSettings ? getPublicSeoSiteName(siteSettings) : undefined,
    imageUrl: siteSettings ? getDefaultPublicSocialImageUrl(siteSettings) : undefined,
    imageAlt: unit.title,
    structuredData: [
      {
        id: "rcat-organization-page-jsonld",
        data: {
          "@context": "https://schema.org",
          "@type": "WebPage",
          url: resolvePublicSeoUrl(canonicalPath),
          name: unit.title,
          description
        }
      },
      {
        id: "rcat-breadcrumb-jsonld",
        data: buildPublicBreadcrumbJsonLd(breadcrumbs)
      }
    ]
  });
}

export function getCmsRouteHead() {
  return buildPublicRouteHead({
    title: "ระบบจัดการเนื้อหา",
    robots: "noindex,nofollow",
    social: false
  });
}
