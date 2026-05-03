const DEFAULT_MAP_URL = "https://maps.app.goo.gl/yhCsgrkLgd1pekM28";

const DEFAULT_SITE_SETTINGS = {
  siteName: "",
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
  heroTitle: "",
  heroDescription: "",
  heroChip: "",
  heroImageUrl: "",
  directorName: "",
  directorTitle: "",
  directorDescription: "",
  directorImageUrl: "",
  mapUrl: DEFAULT_MAP_URL,
  mapEmbedUrl: "",
  footerTitle: "",
  footerDescription: ""
};

const STARTER_PUBLIC_SITE_SETTINGS = {
  ...DEFAULT_SITE_SETTINGS,
  siteName: "เว็บไซต์สถานศึกษา",
  heroTitle: "เว็บไซต์สถานศึกษา",
  mapUrl: DEFAULT_MAP_URL,
  footerTitle: "เว็บไซต์สถานศึกษา"
};

const STARTER_PUBLIC_MENU_ITEMS = [
  { id: "starter-home", label: "หน้าแรก", href: "/" },
  { id: "starter-news", label: "ข่าวสาร", href: "/news" },
  { id: "starter-announcements", label: "ประกาศ", href: "/announcements" },
  { id: "starter-departments", label: "หลักสูตร", href: "/departments" },
  { id: "starter-contact", label: "ติดต่อ", href: "/contact" }
];

const SITE_SETTINGS_URL_FIELDS = [
  "admissionUrl",
  "facebookUrl",
  "youtubeUrl",
  "tiktokUrl",
  "heroImageUrl",
  "directorImageUrl",
  "mapUrl",
  "mapEmbedUrl"
];

const SITE_SETTINGS_LONG_TEXT_FIELDS = [
  "intro",
  "address",
  "heroDescription",
  "directorDescription",
  "footerDescription"
];

const SITE_SETTINGS_TEXT_MAX_LENGTH = 120;
const SITE_SETTINGS_DESCRIPTION_MAX_LENGTH = 500;

function getSiteSettings() {
  const spreadsheet = getSpreadsheet();
  const sheet = getOrEnsureSettingsSheet(spreadsheet);
  const rawValue = getSheetSettingValue(sheet, SETTING_KEYS.siteSettings);
  let parsed = {};

  if (rawValue) {
    try {
      parsed = JSON.parse(rawValue);
    } catch (error) {
      console.warn(`Unable to parse site settings: ${error.message || error}`);
    }
  }

  return normalizeSiteSettings(parsed);
}

function updateSiteSettings(input) {
  const spreadsheet = getSpreadsheet();
  const sheet = getOrEnsureSettingsSheet(spreadsheet);
  const currentSettings = getSiteSettings();
  const nextSettings = normalizeSiteSettings(
    {
      ...currentSettings,
      ...(input || {})
    },
    {
      validate: true
    }
  );

  upsertSetting(sheet, SETTING_KEYS.siteSettings, JSON.stringify(nextSettings));
  invalidatePublicSnapshotCache();
  return nextSettings;
}

function smokeTestSiteSettings() {
  const settings = getSiteSettings();
  const updated = updateSiteSettings({
    siteName: settings.siteName || "เว็บไซต์สถานศึกษา",
    heroTitle: settings.heroTitle || "เว็บไซต์สถานศึกษา"
  });

  return {
    ok: true,
    siteName: updated.siteName,
    heroTitle: updated.heroTitle
  };
}

function normalizeSiteSettings(input, options) {
  const config = options || {};
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const normalized = {};

  Object.keys(DEFAULT_SITE_SETTINGS).forEach((key) => {
    if (SITE_SETTINGS_URL_FIELDS.indexOf(key) !== -1) {
      normalized[key] = normalizeSiteSettingsUrl(source[key], key, config);
      return;
    }

    normalized[key] = normalizeSiteSettingsText(
      source[key],
      key,
      SITE_SETTINGS_LONG_TEXT_FIELDS.indexOf(key) !== -1
        ? SITE_SETTINGS_DESCRIPTION_MAX_LENGTH
        : SITE_SETTINGS_TEXT_MAX_LENGTH,
      config
    );
  });

  return normalized;
}

function seedStarterPublicSiteSettings() {
  const spreadsheet = getSpreadsheet();
  const settingsSheet = getOrEnsureSettingsSheet(spreadsheet);
  const rawSiteSettings = getSheetSettingValue(settingsSheet, SETTING_KEYS.siteSettings);
  const siteSettingsSeeded = shouldSeedSiteSettings(rawSiteSettings);
  const menuSeeded = seedStarterPublicMenuIfEmpty(spreadsheet);

  if (siteSettingsSeeded) {
    upsertSetting(
      settingsSheet,
      SETTING_KEYS.siteSettings,
      JSON.stringify(normalizeSiteSettings(STARTER_PUBLIC_SITE_SETTINGS))
    );
  }

  if (siteSettingsSeeded || menuSeeded) {
    invalidatePublicSnapshotCache();
  }

  return {
    siteSettingsSeeded,
    menuSeeded
  };
}

function shouldSeedSiteSettings(rawValue) {
  if (!rawValue) {
    return true;
  }

  try {
    const parsed = JSON.parse(rawValue);
    const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};

    return Object.keys(DEFAULT_SITE_SETTINGS).every((key) => {
      const value = String(source[key] || "").trim();
      return !value || (key === "mapUrl" && value === DEFAULT_MAP_URL);
    });
  } catch (error) {
    console.warn(
      `Starter site settings seed skipped because existing siteSettings could not be parsed: ${error.message || error}`
    );
    return false;
  }
}

function seedStarterPublicMenuIfEmpty(spreadsheet) {
  const sheet = ensureSheet(spreadsheet, SHEETS.menu, MENU_HEADERS);
  const existingRows = readObjects(sheet, MENU_HEADERS);

  if (existingRows.length) {
    return false;
  }

  const rows = STARTER_PUBLIC_MENU_ITEMS.map((item, index) => [item.id, "", item.label, item.href, index, "TRUE"]);

  sheet.getRange(2, 1, rows.length, MENU_HEADERS.length).setValues(rows);
  return true;
}

function normalizeSiteSettingsText(value, fieldName, maxLength, options) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  if (options && options.validate) {
    throw createHttpError(`${fieldName} must be ${maxLength} characters or fewer.`, 400);
  }

  return text.slice(0, maxLength);
}

function normalizeSiteSettingsUrl(value, fieldName, options) {
  const url = String(value || "").trim();

  if (!url) {
    return "";
  }

  try {
    if (fieldName === "mapUrl") {
      return normalizeSiteSettingsMapUrl(url);
    }

    if (fieldName === "mapEmbedUrl") {
      return normalizeSiteSettingsMapEmbedUrl(url);
    }

    return normalizePublicMediaUrl(url);
  } catch (error) {
    if (options && options.validate) {
      throw createHttpError(getSiteSettingsUrlErrorMessage(fieldName), 400);
    }

    console.warn(`Dropping unsafe site settings URL for ${fieldName}: ${error.message || error}`);
    return "";
  }
}

function extractIframeSrc(value) {
  const input = String(value || "").trim();

  if (!/<iframe\b/i.test(input)) {
    return input;
  }

  const srcMatch = input.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);

  return srcMatch ? decodeIframeSrcHtmlEntities(srcMatch[2]) : "";
}

function decodeIframeSrcHtmlEntities(value) {
  return String(value || "").replace(/&amp;/gi, "&");
}

function normalizeSiteSettingsMapUrl(url) {
  const normalized = normalizePublicMediaUrl(url);
  const parts = parseSiteSettingsHttpsUrl(normalized);

  if (parts.hostname === "maps.app.goo.gl") {
    return normalized;
  }

  if (
    (parts.hostname === "www.google.com" || parts.hostname === "google.com" || parts.hostname === "maps.google.com") &&
    parts.pathname.indexOf("/maps") === 0
  ) {
    return normalized;
  }

  throw createHttpError("mapUrl must be a Google Maps https URL or empty.", 400);
}

function normalizeSiteSettingsMapEmbedUrl(url) {
  const normalized = normalizePublicMediaUrl(extractIframeSrc(url), ["www.google.com"]);
  const parts = parseSiteSettingsHttpsUrl(normalized);

  if (parts.hostname === "www.google.com" && parts.pathname === "/maps/embed") {
    return normalized;
  }

  throw createHttpError("mapEmbedUrl must be a Google Maps embed https URL or empty.", 400);
}

function parseSiteSettingsHttpsUrl(url) {
  const match = String(url || "").match(/^https:\/\/([^/?#]+)([^?#]*)/i);

  if (!match || !match[1]) {
    throw createHttpError("Invalid public URL.", 400);
  }

  return {
    hostname: match[1].split(":")[0].toLowerCase(),
    pathname: match[2] || "/"
  };
}

function getSiteSettingsUrlErrorMessage(fieldName) {
  if (fieldName === "mapUrl") {
    return "mapUrl must be a Google Maps https URL or empty.";
  }

  if (fieldName === "mapEmbedUrl") {
    return "mapEmbedUrl must be a Google Maps embed https URL or empty.";
  }

  return `${fieldName} must be an https URL or empty.`;
}
