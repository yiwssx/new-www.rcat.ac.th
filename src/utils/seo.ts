import { useEffect } from "react";
import { getPublicSiteUrl, projectSettings } from "../config/projectSettings";

interface DocumentMetadataInput {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  canonicalPath?: string;
}

function getSiteName() {
  return projectSettings.site.name;
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

export function buildDocumentTitle(title?: string) {
  const normalizedTitle = title?.trim();
  const siteName = getSiteName();

  if (!normalizedTitle) {
    return siteName;
  }

  if (normalizedTitle.includes(siteName)) {
    return normalizedTitle;
  }

  return `${normalizedTitle} | ${siteName}`;
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

function resolveCanonicalUrl(input: DocumentMetadataInput) {
  const canonical = input.canonicalUrl?.trim() || input.canonicalPath?.trim();

  if (!canonical) {
    return "";
  }

  try {
    return new URL(canonical, `${getCanonicalBaseUrl()}/`).toString();
  } catch {
    return "";
  }
}

export function updateDocumentMetadata(input: DocumentMetadataInput) {
  if (typeof document === "undefined") {
    return;
  }

  document.title = buildDocumentTitle(input.title);

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
  useEffect(() => {
    updateDocumentMetadata(input);
  }, [input.title, input.description, input.canonicalUrl, input.canonicalPath]);
}
