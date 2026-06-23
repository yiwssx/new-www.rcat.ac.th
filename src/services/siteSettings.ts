import { FooterDirectoryGroup, FooterDirectoryLink, SiteSettings } from "../types";

const shortTextMaxLength = 120;
const longTextMaxLength = 500;
const neutralSiteName = "เว็บไซต์สถานศึกษา";
export const legacyDefaultMapUrl = "https://maps.app.goo.gl/yhCsgrkLgd1pekM28";
const urlFields = new Set<keyof SiteSettings>([
  "admissionUrl",
  "facebookUrl",
  "youtubeUrl",
  "tiktokUrl",
  "heroImageUrl",
  "directorImageUrl",
  "mapUrl",
  "mapEmbedUrl",
  "messengerUrl"
]);
const longTextFields = new Set<keyof SiteSettings>([
  "intro",
  "address",
  "heroDescription",
  "directorDescription",
  "footerDescription",
  "mourningModeNotice"
]);
const googleDriveImageHosts = new Set(["drive.google.com", "www.drive.google.com"]);
const googleDriveFileIdPattern = /^[a-zA-Z0-9_-]+$/;

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
  mapUrl: "",
  mapEmbedUrl: "",
  footerTitle: neutralSiteName,
  footerDescription: "",
  footerDirectoryGroups: [],
  messengerUrl: "",
  messengerLabel: "แชทกับเจ้าหน้าที่",
  messengerEnabled: false,
  mourningModeEnabled: false,
  mourningModeLabel: "โหมดไว้อาลัย",
  mourningModeNotice: ""
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeFooterDirectoryLink(value: unknown): FooterDirectoryLink {
  const source = isRecord(value) ? value : {};

  return {
    label: normalizeText(source.label, shortTextMaxLength),
    href: String(source.href || "").trim(),
    enabled: normalizeBoolean(source.enabled)
  };
}

function normalizeFooterDirectoryGroups(value: unknown): FooterDirectoryGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((group) => {
      const source = isRecord(group) ? group : {};
      const links = Array.isArray(source.links) ? source.links.map(normalizeFooterDirectoryLink) : [];

      return {
        title: normalizeText(source.title, shortTextMaxLength),
        links
      };
    })
    .filter((group) => group.title || group.links.some((link) => link.label || link.href));
}

function hasUnsafeUrlCharacter(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "\\" || /\s/.test(char)) {
      return true;
    }
  }

  return false;
}

function normalizeHttpsUrl(value: unknown) {
  const url = String(value || "").trim();

  if (!url) {
    return "";
  }

  if (hasUnsafeUrlCharacter(url)) {
    return "";
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

export function extractGoogleDriveFileId(value: string) {
  const url = String(value || "").trim();

  if (!url || hasUnsafeUrlCharacter(url)) {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" || !googleDriveImageHosts.has(parsed.hostname.toLowerCase())) {
      return "";
    }

    const pathFileId = parsed.pathname.match(/^\/file\/d\/([^/]+)(?:\/|$)/)?.[1] || "";
    const fileId = pathFileId || parsed.searchParams.get("id") || "";

    return googleDriveFileIdPattern.test(fileId) ? fileId : "";
  } catch {
    return "";
  }
}

export function normalizeGoogleDriveImageUrl(value: string) {
  const fileId = extractGoogleDriveFileId(value);

  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200` : "";
}

function normalizeDirectorImageUrl(value: unknown) {
  const url = normalizeHttpsUrl(value);

  if (!url) {
    return "";
  }

  const parsed = new URL(url);

  if (googleDriveImageHosts.has(parsed.hostname.toLowerCase())) {
    return normalizeGoogleDriveImageUrl(url);
  }

  return url;
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
  if (String(value || "").trim() === legacyDefaultMapUrl) {
    return "";
  }

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
    (hostname === "www.google.com" || hostname === "google.com" || hostname === "maps.google.com") &&
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

    if (key === "footerDirectoryGroups") {
      normalized.footerDirectoryGroups = normalizeFooterDirectoryGroups(source[key]);
      return;
    }

    if (key === "messengerEnabled" || key === "mourningModeEnabled") {
      normalized[key] = normalizeBoolean(source[key]);
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

      if (key === "directorImageUrl") {
        normalized[key] = normalizeDirectorImageUrl(source[key]);
        return;
      }

      normalized[key] = normalizeHttpsUrl(source[key]);
      return;
    }

    normalized[key] = normalizeText(source[key], longTextFields.has(key) ? longTextMaxLength : shortTextMaxLength);
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

  if (!normalized.messengerLabel) {
    normalized.messengerLabel = defaultSiteSettings.messengerLabel;
  }

  if (!normalized.mourningModeLabel) {
    normalized.mourningModeLabel = defaultSiteSettings.mourningModeLabel;
  }

  return normalized;
}
