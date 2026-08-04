import { getPublicSiteUrl, projectSettings } from "../../config/projectSettings";
import type { ContentItem, MediaAsset, PublicContentDetailSnapshot, SiteSettings } from "../../types";
import { resolvePublicImageSource } from "../../shared/media/publicImageSources";

export interface PublicBreadcrumbItem {
  name: string;
  path: string;
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

export function getPublicSeoBaseUrl(value = getPublicSiteUrl(), fallback = projectSettings.site.publicSiteUrl): string {
  const siteUrl = trimTrailingSlash(value || "");

  if (!siteUrl) {
    return fallback ? getPublicSeoBaseUrl(fallback, "") : "https://example.edu";
  }

  if (isLocalSiteUrl(siteUrl) && fallback) {
    return getPublicSeoBaseUrl(fallback, "");
  }

  if (hasProtocol(siteUrl)) {
    return siteUrl;
  }

  return `https://${siteUrl}`;
}

export function resolvePublicSeoUrl(value: string | null | undefined) {
  const candidate = String(value || "").trim();
  const isInternalPath = candidate.startsWith("/") && !candidate.startsWith("//");
  const isHttpUrl = /^https?:\/\//i.test(candidate);

  if (!isInternalPath && !isHttpUrl) {
    return "";
  }

  try {
    return new URL(candidate, `${getPublicSeoBaseUrl()}/`).toString();
  } catch {
    return "";
  }
}

export function getPublicSeoSiteName(siteSettings?: SiteSettings) {
  return siteSettings?.siteName?.trim() || projectSettings.site.name;
}

export function getPublicSeoLocale() {
  return projectSettings.site.locale.replace("-", "_");
}

export function getPublicSeoLogoUrl() {
  return resolvePublicSeoUrl(projectSettings.site.logoPath);
}

export function getDefaultPublicSocialImageUrl(siteSettings?: SiteSettings) {
  const source = resolvePublicImageSource(siteSettings?.heroImageUrl, "hero").src;
  return resolvePublicSeoUrl(source);
}

function getContentFeaturedMedia(item: ContentItem, media: MediaAsset[]) {
  if (item.featuredMediaId) {
    const featured = media.find((asset) => asset.id === item.featuredMediaId && asset.type === "image");
    if (featured) {
      return featured;
    }
  }

  return media.find((asset) => asset.type === "image");
}

export function getPublicContentSocialImageUrl(snapshot?: PublicContentDetailSnapshot, siteSettings?: SiteSettings) {
  if (snapshot) {
    const featuredMedia = getContentFeaturedMedia(snapshot.item, snapshot.media);
    const source = resolvePublicImageSource(featuredMedia, "content-featured").src;
    const resolved = resolvePublicSeoUrl(source);

    if (resolved) {
      return resolved;
    }
  }

  return getDefaultPublicSocialImageUrl(siteSettings);
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null || entry === "") {
        return false;
      }

      if (Array.isArray(entry)) {
        return entry.length > 0;
      }

      return true;
    })
  );
}

function getOrganizationReference() {
  return `${getPublicSeoBaseUrl()}/#organization`;
}

export function buildPublicOrganizationJsonLd(siteSettings?: SiteSettings) {
  const sameAs = [siteSettings?.facebookUrl, siteSettings?.youtubeUrl, siteSettings?.tiktokUrl]
    .map((value) => resolvePublicSeoUrl(value))
    .filter(Boolean);

  return compactObject({
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": getOrganizationReference(),
    name: getPublicSeoSiteName(siteSettings),
    url: `${getPublicSeoBaseUrl()}/`,
    logo: getPublicSeoLogoUrl(),
    description: siteSettings?.intro?.trim() || siteSettings?.heroDescription?.trim(),
    address: siteSettings?.address?.trim(),
    telephone: siteSettings?.phone?.trim(),
    email: siteSettings?.email?.trim(),
    sameAs
  });
}

export function buildPublicWebsiteJsonLd(siteSettings?: SiteSettings, description?: string) {
  return compactObject({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${getPublicSeoBaseUrl()}/#website`,
    url: `${getPublicSeoBaseUrl()}/`,
    name: getPublicSeoSiteName(siteSettings),
    description: description?.trim(),
    publisher: {
      "@id": getOrganizationReference()
    }
  });
}

export function buildPublicBreadcrumbJsonLd(items: readonly PublicBreadcrumbItem[]) {
  const itemListElement = items
    .map((item, index) => {
      const itemUrl = resolvePublicSeoUrl(item.path);
      const name = item.name.trim();

      if (!itemUrl || !name) {
        return null;
      }

      return {
        "@type": "ListItem",
        position: index + 1,
        name,
        item: itemUrl
      };
    })
    .filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement
  };
}

function getContentStructuredDataType(item: ContentItem) {
  if (item.type === "news") {
    return "NewsArticle";
  }

  if (item.type === "blog" || item.type === "announcement") {
    return "Article";
  }

  return "WebPage";
}

export function isPublicArticleContent(item: ContentItem) {
  return item.type === "news" || item.type === "blog" || item.type === "announcement";
}

export function buildPublicContentJsonLd(input: {
  snapshot: PublicContentDetailSnapshot;
  siteSettings?: SiteSettings;
  canonicalUrl: string;
  description: string;
  imageUrl?: string;
}) {
  const { item } = input.snapshot;
  const type = getContentStructuredDataType(item);
  const common = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${input.canonicalUrl}#primary",
    url: input.canonicalUrl,
    name: item.title.trim(),
    description: input.description.trim(),
    mainEntityOfPage: input.canonicalUrl,
    datePublished: item.publishAt || undefined,
    dateModified: item.updatedAt || undefined,
    image: input.imageUrl || undefined,
    publisher: {
      "@id": getOrganizationReference()
    }
  };

  if (!isPublicArticleContent(item)) {
    return compactObject(common);
  }

  return compactObject({
    ...common,
    headline: item.title.trim(),
    articleSection: item.category?.trim(),
    keywords: Array.isArray(item.tags) ? item.tags.filter(Boolean).join(", ") : undefined
  });
}

export function serializePublicJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
