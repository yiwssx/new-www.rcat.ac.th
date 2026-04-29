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
  footerTitle: "",
  footerDescription: ""
};

const SITE_SETTINGS_URL_FIELDS = [
  "admissionUrl",
  "facebookUrl",
  "youtubeUrl",
  "tiktokUrl",
  "heroImageUrl"
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
  const sheet = spreadsheet.getSheetByName(SHEETS.settings);
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
  const sheet = spreadsheet.getSheetByName(SHEETS.settings) || ensureSettingsSheet(spreadsheet);
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
    return normalizePublicMediaUrl(url);
  } catch (error) {
    if (options && options.validate) {
      throw createHttpError(`${fieldName} must be an https URL or empty.`, 400);
    }

    console.warn(`Dropping unsafe site settings URL for ${fieldName}: ${error.message || error}`);
    return "";
  }
}
