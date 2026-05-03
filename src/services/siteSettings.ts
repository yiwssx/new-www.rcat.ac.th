import { SiteSettings } from "../types";

const shortTextMaxLength = 120;
const longTextMaxLength = 500;
const neutralSiteName = "เว็บไซต์สถานศึกษา";
const defaultMapUrl = "https://maps.app.goo.gl/yhCsgrkLgd1pekM28";
const urlFields = new Set<keyof SiteSettings>([
  "admissionUrl",
  "facebookUrl",
  "youtubeUrl",
  "tiktokUrl",
  "heroImageUrl",
  "directorImageUrl",
  "mapUrl",
  "mapEmbedUrl"
]);
const longTextFields = new Set<keyof SiteSettings>([
  "intro",
  "address",
  "heroDescription",
  "directorDescription",
  "footerDescription"
]);

export const defaultSiteSettings: SiteSettings = {
  siteName: neutralSiteName,
  eyebrow: "",
  intro: "",
  campus: "",
  phone: "",
  fax: "",
  email: "",
  address: "",
  admissionUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  heroTitle: neutralSiteName,
  heroDescription: "",
  heroChip: "",
  heroImageUrl: "",
  directorName: "",
  directorTitle: "",
  directorDescription: "",
  directorImageUrl: "",
  mapUrl: defaultMapUrl,
  mapEmbedUrl: "",
  footerTitle: neutralSiteName,
  footerDescription: ""
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeHttpsUrl(value: unknown) {
  const url = String(value || "").trim();

  if (!url) {
    return "";
  }

  if (/[\u0000-\u001F\u007F\s\\]/.test(url)) {
    return "";
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function decodeIframeSrcHtmlEntities(value: string) {
  return value.replace(/&amp;/gi, "&");
}

export function extractIframeSrc(value: string): string {
  const input = String(value || "").trim();

  if (!/<iframe\b/i.test(input)) {
    return input;
  }

  const srcMatch = input.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);

  return srcMatch ? decodeIframeSrcHtmlEntities(srcMatch[2]) : "";
}

function normalizeMapUrl(value: unknown) {
  const url = normalizeHttpsUrl(value);

  if (!url) {
    return "";
  }

  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "maps.app.goo.gl") {
    return url;
  }

  if (
    (hostname === "www.google.com" ||
      hostname === "google.com" ||
      hostname === "maps.google.com") &&
    parsed.pathname.startsWith("/maps")
  ) {
    return url;
  }

  return "";
}

function normalizeMapEmbedUrl(value: unknown) {
  const url = normalizeHttpsUrl(extractIframeSrc(String(value || "")));

  if (!url) {
    return "";
  }

  const parsed = new URL(url);

  if (parsed.hostname.toLowerCase() === "www.google.com" && parsed.pathname === "/maps/embed") {
    return url;
  }

  return "";
}

export function normalizeSiteSettings(input: unknown): SiteSettings {
  const source = isRecord(input) ? input : {};
  const normalized = {
    ...defaultSiteSettings
  };

  (Object.keys(defaultSiteSettings) as Array<keyof SiteSettings>).forEach((key) => {
    if (!(key in source)) {
      return;
    }

    if (urlFields.has(key)) {
      if (key === "mapUrl") {
        normalized[key] = normalizeMapUrl(source[key]);
        return;
      }

      if (key === "mapEmbedUrl") {
        normalized[key] = normalizeMapEmbedUrl(source[key]);
        return;
      }

      normalized[key] = normalizeHttpsUrl(source[key]);
      return;
    }

    normalized[key] = normalizeText(
      source[key],
      longTextFields.has(key) ? longTextMaxLength : shortTextMaxLength
    );
  });

  if (!normalized.siteName) {
    normalized.siteName = defaultSiteSettings.siteName;
  }

  if (!normalized.heroTitle) {
    normalized.heroTitle = normalized.siteName;
  }

  if (!normalized.footerTitle) {
    normalized.footerTitle = normalized.siteName;
  }

  return normalized;
}
