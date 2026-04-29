import { projectSettings } from "../config/projectSettings";
import { SiteSettings } from "../types";

const shortTextMaxLength = 120;
const longTextMaxLength = 500;
const urlFields = new Set<keyof SiteSettings>([
  "admissionUrl",
  "facebookUrl",
  "youtubeUrl",
  "tiktokUrl",
  "heroImageUrl"
]);
const longTextFields = new Set<keyof SiteSettings>([
  "intro",
  "address",
  "heroDescription",
  "directorDescription",
  "footerDescription"
]);

export const defaultSiteSettings: SiteSettings = {
  siteName: projectSettings.site.name,
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
  heroTitle: projectSettings.site.name,
  heroDescription: "",
  heroChip: "",
  heroImageUrl: "",
  directorName: "",
  directorTitle: "",
  directorDescription: "",
  footerTitle: projectSettings.site.name,
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
