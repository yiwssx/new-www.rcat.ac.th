import { useEffect } from "react";
import { getPublicSiteUrl, projectSettings } from "../config/projectSettings";
import { normalizeSafeHref } from "./safeUrl";

export interface DocumentMetadataInput {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  canonicalPath?: string;
  siteName?: string;
}

function getSiteName(siteName?: string) {
  return siteName?.trim() || projectSettings.site.name;
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

export function buildDocumentTitle(title?: string, siteName?: string) {
  const normalizedTitle = title?.trim();
  const normalizedSiteName = getSiteName(siteName);

  if (!normalizedTitle) {
    return normalizedSiteName;
  }

  if (normalizedTitle.includes(normalizedSiteName)) {
    return normalizedTitle;
  }

  return `${normalizedTitle} | ${normalizedSiteName}`;
}

function getOrCreateDescriptionMeta() {
  const existing = document.querySelector<HTMLMetaElement>("meta[name='description']");

  if (existing) {
    return existing;
  }

  const meta = document.createElement("meta");
  meta.setAttribute("name", "description");
  document.head.appendChild(meta);

  return meta;
}

function getCanonicalLink() {
  return document.querySelector<HTMLLinkElement>("link[rel='canonical']");
}

function getOrCreateCanonicalLink() {
  const existing = getCanonicalLink();

  if (existing) {
    return existing;
  }

  const link = document.createElement("link");
  link.setAttribute("rel", "canonical");
  document.head.appendChild(link);

  return link;
}

function isCanonicalHref(value: string) {
  const lowerValue = value.toLowerCase();
  return value.startsWith("/") || lowerValue.startsWith("http://") || lowerValue.startsWith("https://");
}

export function resolveCanonicalUrl(input: Pick<DocumentMetadataInput, "canonicalUrl" | "canonicalPath">) {
  const candidates = [input.canonicalUrl, input.canonicalPath];

  for (const candidate of candidates) {
    const canonical = normalizeSafeHref(candidate || "");

    if (!isCanonicalHref(canonical)) {
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

export function updateDocumentMetadata(input: DocumentMetadataInput) {
  if (typeof document === "undefined") {
    return;
  }

  document.title = buildDocumentTitle(input.title, input.siteName);

  const description = input.description?.trim();
  const descriptionMeta = getOrCreateDescriptionMeta();
  descriptionMeta.setAttribute("content", description || "");

  const canonicalUrl = resolveCanonicalUrl(input);
  const canonicalLink = getCanonicalLink();

  if (!canonicalUrl) {
    canonicalLink?.remove();
    return;
  }

  getOrCreateCanonicalLink().setAttribute("href", canonicalUrl);
}

export function useDocumentMetadata(input: DocumentMetadataInput) {
  const { title, description, canonicalUrl, canonicalPath, siteName } = input;

  useEffect(() => {
    updateDocumentMetadata({ title, description, canonicalUrl, canonicalPath, siteName });
  }, [title, description, canonicalUrl, canonicalPath, siteName]);
}
