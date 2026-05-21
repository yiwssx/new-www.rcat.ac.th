function getSpreadsheet() {
  const spreadsheetId = getSetting(SETTING_KEYS.spreadsheetId);

  if (!spreadsheetId) {
    throw new Error("Run setupCmsBackend first so the spreadsheet id can be stored.");
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheet(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const maxColumns = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders =
    sheet.getLastRow() >= 1
      ? sheet
          .getRange(1, 1, 1, maxColumns)
          .getValues()[0]
          .filter((header) => header)
      : [];

  if (!currentHeaders.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const mergedHeaders = headers.concat(currentHeaders.filter((header) => headers.indexOf(header) === -1));
  const hasHeaders = mergedHeaders.every((header, index) => currentHeaders[index] === header);

  if (!hasHeaders) {
    const existingRows =
      sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, currentHeaders.length).getValues() : [];
    const nextRows = existingRows.map((row) =>
      mergedHeaders.map((header) => {
        const sourceIndex = currentHeaders.indexOf(header);
        return sourceIndex === -1 ? "" : row[sourceIndex];
      })
    );

    sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
    if (nextRows.length) {
      sheet.getRange(2, 1, nextRows.length, mergedHeaders.length).setValues(nextRows);
    }
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureSettingsSheet(spreadsheet) {
  const sheet = ensureSheet(spreadsheet, SHEETS.settings, ["key", "value"]);
  const settings = [
    {
      key: SETTING_KEYS.publicSiteUrl,
      value: getSetting(SETTING_KEYS.publicSiteUrl)
    },
    {
      key: SETTING_KEYS.driveFolderId,
      value: getSetting(SETTING_KEYS.driveFolderId)
    },
    {
      key: SETTING_KEYS.docsFolderId,
      value: getSetting(SETTING_KEYS.docsFolderId)
    },
    {
      key: SETTING_KEYS.spreadsheetName,
      value: getSetting(SETTING_KEYS.spreadsheetName)
    },
    {
      key: SETTING_KEYS.rootFolderName,
      value: getSetting(SETTING_KEYS.rootFolderName)
    },
    {
      key: SETTING_KEYS.mediaFolderName,
      value: getSetting(SETTING_KEYS.mediaFolderName)
    },
    {
      key: SETTING_KEYS.docsFolderName,
      value: getSetting(SETTING_KEYS.docsFolderName)
    },
    {
      key: SETTING_KEYS.authSessionHours,
      value: getSetting(SETTING_KEYS.authSessionHours)
    },
    {
      key: SETTING_KEYS.dateDisplayFormat,
      value: getSetting(SETTING_KEYS.dateDisplayFormat)
    },
    {
      key: SETTING_KEYS.timeDisplayMode,
      value: getSetting(SETTING_KEYS.timeDisplayMode)
    }
  ];

  settings.forEach((setting) => upsertSetting(sheet, setting.key, setting.value));
  upsertSettingIfMissing(sheet, SETTING_KEYS.siteSettings, JSON.stringify(DEFAULT_SITE_SETTINGS));
  upsertSettingIfMissing(sheet, SETTING_KEYS.homepageSettings, JSON.stringify(DEFAULT_HOMEPAGE_SETTINGS));
  upsertSettingIfMissing(sheet, SETTING_KEYS.visitorStats, JSON.stringify(DEFAULT_VISITOR_STATS));
  return sheet;
}

function getOrEnsureSettingsSheet(spreadsheet) {
  return spreadsheet.getSheetByName(SHEETS.settings) || ensureSettingsSheet(spreadsheet);
}

function getOrEnsureVisitorStatsSheet(spreadsheet) {
  return ensureSheet(spreadsheet, SHEETS.visitorStats, VISITOR_STATS_HEADERS);
}

function upsertSetting(sheet, key, value) {
  const rows = sheet.getDataRange().getValues();

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index][0] === key) {
      sheet.getRange(index + 1, 2).setValue(value);
      return;
    }
  }

  sheet.appendRow([key, value]);
}

function upsertSettingIfMissing(sheet, key, value) {
  const rows = sheet.getDataRange().getValues();

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index][0] === key) {
      return;
    }
  }

  sheet.appendRow([key, value]);
}

function getSheetSettingValue(sheet, key) {
  if (!sheet || !key || sheet.getLastRow() < 2) {
    return "";
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();

  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || "") === String(key)) {
      return normalizeCell(values[index][1]);
    }
  }

  return "";
}

function normalizeTimeDisplayMode(value) {
  return value === "12h" ? "12h" : "24h";
}

function normalizeDateDisplayFormat(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.dateDisplayFormat];
  }

  if (normalized.length > 80 || /[^A-Za-z0-9 :/.,_\-\[\]\\]/.test(normalized)) {
    return DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.dateDisplayFormat];
  }

  return normalized;
}

function getDisplaySettings() {
  return {
    dateFormat: normalizeDateDisplayFormat(
      getSetting(SETTING_KEYS.dateDisplayFormat) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.dateDisplayFormat]
    ),
    timeMode: normalizeTimeDisplayMode(
      getSetting(SETTING_KEYS.timeDisplayMode) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.timeDisplayMode]
    )
  };
}

function updateDisplaySettings(input) {
  const settings = getDisplaySettings();
  const dateFormat = normalizeDateDisplayFormat(
    input && input.dateFormat !== undefined ? input.dateFormat : settings.dateFormat
  );
  const timeMode = normalizeTimeDisplayMode(input && input.timeMode !== undefined ? input.timeMode : settings.timeMode);

  setSetting(SETTING_KEYS.dateDisplayFormat, dateFormat);
  setSetting(SETTING_KEYS.timeDisplayMode, timeMode);
  ensureSettingsSheet(getSpreadsheet());

  const updatedSettings = getDisplaySettings();
  invalidatePublicSnapshotCache();
  return updatedSettings;
}

function cloneObject(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function safeJsonParseObject(value, fallback) {
  if (!value) {
    return cloneObject(fallback);
  }

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn(`Unable to parse JSON settings object: ${error.message || error}`);
  }

  return cloneObject(fallback);
}

function normalizeHomepageSettings(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const defaults = DEFAULT_HOMEPAGE_SETTINGS;
  const carousel =
    source.carousel && typeof source.carousel === "object" && !Array.isArray(source.carousel) ? source.carousel : {};
  const introGate =
    source.introGate && typeof source.introGate === "object" && !Array.isArray(source.introGate)
      ? source.introGate
      : {};
  const marquee =
    source.marquee && typeof source.marquee === "object" && !Array.isArray(source.marquee) ? source.marquee : {};
  const introVideo =
    source.introVideo && typeof source.introVideo === "object" && !Array.isArray(source.introVideo)
      ? source.introVideo
      : {};
  const autoplayIntervalSeconds = Number(carousel.autoplayIntervalSeconds);
  const speedSeconds = Number(marquee.speedSeconds);

  return {
    carousel: {
      autoplayEnabled:
        typeof carousel.autoplayEnabled === "boolean" ? carousel.autoplayEnabled : defaults.carousel.autoplayEnabled,
      autoplayIntervalSeconds: Number.isFinite(autoplayIntervalSeconds)
        ? Math.min(30, Math.max(3, autoplayIntervalSeconds))
        : defaults.carousel.autoplayIntervalSeconds
    },
    introGate: {
      enabled: introGate.enabled === true,
      imageUrl: normalizeHomepageSettingsString(introGate.imageUrl, defaults.introGate.imageUrl),
      imageAlt: normalizeHomepageSettingsString(introGate.imageAlt, defaults.introGate.imageAlt),
      primaryButtonLabel: normalizeHomepageSettingsString(
        introGate.primaryButtonLabel,
        defaults.introGate.primaryButtonLabel
      ),
      secondaryButtonLabel: normalizeHomepageSettingsString(
        introGate.secondaryButtonLabel,
        defaults.introGate.secondaryButtonLabel
      ),
      secondaryButtonUrl: normalizeHomepageSettingsString(
        introGate.secondaryButtonUrl,
        defaults.introGate.secondaryButtonUrl
      ),
      storageKey: normalizeHomepageSettingsString(introGate.storageKey, defaults.introGate.storageKey)
    },
    marquee: {
      enabled: marquee.enabled === true,
      label: normalizeHomepageSettingsString(marquee.label, defaults.marquee.label),
      text: normalizeHomepageSettingsString(marquee.text, defaults.marquee.text),
      speedSeconds: Number.isFinite(speedSeconds)
        ? Math.min(90, Math.max(12, speedSeconds))
        : defaults.marquee.speedSeconds
    },
    introVideo: {
      enabled: introVideo.enabled === true,
      title: normalizeHomepageSettingsString(introVideo.title, defaults.introVideo.title),
      youtubeEmbedUrl: normalizeHomepageSettingsString(introVideo.youtubeEmbedUrl, defaults.introVideo.youtubeEmbedUrl)
    }
  };
}

function normalizeHomepageSettingsString(value, fallback) {
  return typeof value === "string" ? value.trim() : fallback;
}

function getHomepageSettings() {
  const spreadsheet = getSpreadsheet();
  const sheet = getOrEnsureSettingsSheet(spreadsheet);
  const rawValue = getSheetSettingValue(sheet, SETTING_KEYS.homepageSettings);

  return normalizeHomepageSettings(safeJsonParseObject(rawValue, DEFAULT_HOMEPAGE_SETTINGS));
}

function updateHomepageSettings(input) {
  const spreadsheet = getSpreadsheet();
  const sheet = getOrEnsureSettingsSheet(spreadsheet);
  const currentSettings = getHomepageSettings();
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const nextSettings = normalizeHomepageSettings({
    carousel: {
      ...currentSettings.carousel,
      ...(source.carousel && typeof source.carousel === "object" && !Array.isArray(source.carousel)
        ? source.carousel
        : {})
    },
    introGate: {
      ...currentSettings.introGate,
      ...(source.introGate && typeof source.introGate === "object" && !Array.isArray(source.introGate)
        ? source.introGate
        : {})
    },
    marquee: {
      ...currentSettings.marquee,
      ...(source.marquee && typeof source.marquee === "object" && !Array.isArray(source.marquee) ? source.marquee : {})
    },
    introVideo: {
      ...currentSettings.introVideo,
      ...(source.introVideo && typeof source.introVideo === "object" && !Array.isArray(source.introVideo)
        ? source.introVideo
        : {})
    }
  });

  upsertSetting(sheet, SETTING_KEYS.homepageSettings, JSON.stringify(nextSettings));
  invalidatePublicSnapshotCache();
  return nextSettings;
}

function normalizeVisitorStats(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};

  return {
    enabled: source.enabled === true,
    usersToday: normalizeVisitorStatsNumber(source.usersToday),
    usersYesterday: normalizeVisitorStatsNumber(source.usersYesterday),
    usersThisMonth: normalizeVisitorStatsNumber(source.usersThisMonth),
    usersThisYear: normalizeVisitorStatsNumber(source.usersThisYear),
    totalUsers: normalizeVisitorStatsNumber(source.totalUsers),
    totalViews: normalizeVisitorStatsNumber(source.totalViews),
    onlineUsers: normalizeVisitorStatsNumber(source.onlineUsers),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt.trim() : ""
  };
}

function normalizeVisitorStatsNumber(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.floor(numeric));
}

function getVisitorStats() {
  const spreadsheet = getSpreadsheet();
  const sheet = getOrEnsureSettingsSheet(spreadsheet);
  const visitorStatsSheet = getOrEnsureVisitorStatsSheet(spreadsheet);
  const rawValue = getSheetSettingValue(sheet, SETTING_KEYS.visitorStats);
  const storedStats = normalizeVisitorStats(safeJsonParseObject(rawValue, DEFAULT_VISITOR_STATS));
  const countedStats = computeVisitorStats(visitorStatsSheet, new Date());

  return normalizeVisitorStats({
    ...countedStats,
    enabled: storedStats.enabled,
    updatedAt: countedStats.updatedAt || storedStats.updatedAt
  });
}

function updateVisitorStats(input) {
  const spreadsheet = getSpreadsheet();
  const sheet = getOrEnsureSettingsSheet(spreadsheet);
  const rawValue = getSheetSettingValue(sheet, SETTING_KEYS.visitorStats);
  const currentStats = normalizeVisitorStats(safeJsonParseObject(rawValue, DEFAULT_VISITOR_STATS));
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const nextStats = normalizeVisitorStats({
    enabled: source.enabled === true,
    updatedAt: new Date().toISOString()
  });

  upsertSetting(
    sheet,
    SETTING_KEYS.visitorStats,
    JSON.stringify({
      enabled: nextStats.enabled,
      updatedAt: nextStats.updatedAt
    })
  );
  invalidatePublicSnapshotCache();
  return getVisitorStats();
}

const SITE_VIEW_DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
const SITE_VIEW_ONLINE_WINDOW_MS = 5 * 60 * 1000;
const SITE_VIEW_MAX_PATH_LENGTH = 240;
const SITE_VIEW_PERIOD_DATE_LIMIT = 370;
const SITE_VIEW_PERIOD_MONTH_LIMIT = 36;
const SITE_VIEW_PERIOD_YEAR_LIMIT = 10;

function incrementSiteView(input) {
  const siteView = normalizeSiteViewInput(input);
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(3000);

    if (!lockAcquired) {
      throw createVisitorStatsHttpError("Site view counter is busy. Please retry.", 503);
    }

    const spreadsheet = getSpreadsheet();
    const sheet = getOrEnsureVisitorStatsSheet(spreadsheet);
    const now = new Date();

    upsertSiteViewVisitor(sheet, siteView, now);
    return getVisitorStats();
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function normalizeSiteViewInput(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const visitorId = String(source.visitorId || "").trim();
  const path = String(source.path || "").trim();

  if (
    !isValidSiteViewVisitorId(visitorId) ||
    !path ||
    path.length > SITE_VIEW_MAX_PATH_LENGTH ||
    path.charAt(0) !== "/"
  ) {
    throw createVisitorStatsHttpError("Invalid site view payload.", 400);
  }

  if (!isTrackableSiteViewPath(path)) {
    throw createVisitorStatsHttpError("Site view path is not trackable.", 400);
  }

  return {
    visitorId,
    path
  };
}

function isValidSiteViewVisitorId(value) {
  return /^[A-Za-z0-9_-]{12,80}$/.test(String(value || ""));
}

function isTrackableSiteViewPath(path) {
  const normalized = normalizeSiteViewPathForGuard(path);

  return normalized !== "/login" && normalized !== "/admin" && normalized.indexOf("/admin/") !== 0;
}

function normalizeSiteViewPathForGuard(path) {
  const withoutQuery = String(path || "").split(/[?#]/)[0] || "/";
  const withoutTrailingSlash =
    withoutQuery.length > 1 && withoutQuery.endsWith("/") ? withoutQuery.slice(0, -1) : withoutQuery;

  return withoutTrailingSlash || "/";
}

function upsertSiteViewVisitor(sheet, siteView, now) {
  const activeHeaders = getActiveHeaders(sheet, VISITOR_STATS_HEADERS);
  const rows = sheet.getDataRange().getValues();
  const visitorIdIndex = activeHeaders.indexOf("visitorId");
  const nowIso = now.toISOString();
  const periods = getSiteViewPeriodKeys(now);

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];

    if (String(row[visitorIdIndex] || "") !== siteView.visitorId) {
      continue;
    }

    const record = createVisitorStatsRecordFromRow(row, activeHeaders);
    const lastPathAtMs = Date.parse(record.lastPathAt || "");
    const isDuplicatePathView =
      record.lastPath === siteView.path &&
      Number.isFinite(lastPathAtMs) &&
      now.getTime() - lastPathAtMs < SITE_VIEW_DUPLICATE_WINDOW_MS;

    const nextRecord = {
      visitorId: siteView.visitorId,
      firstSeenAt: record.firstSeenAt || nowIso,
      lastSeenAt: nowIso,
      lastPath: siteView.path,
      lastPathAt: nowIso,
      totalViews: normalizeVisitorStatsNumber(record.totalViews) + (isDuplicatePathView ? 0 : 1),
      dateKeys: addVisitorPeriodKey(record.dateKeys, periods.dateKey, SITE_VIEW_PERIOD_DATE_LIMIT),
      monthKeys: addVisitorPeriodKey(record.monthKeys, periods.monthKey, SITE_VIEW_PERIOD_MONTH_LIMIT),
      yearKeys: addVisitorPeriodKey(record.yearKeys, periods.yearKey, SITE_VIEW_PERIOD_YEAR_LIMIT),
      updatedAt: nowIso
    };

    writeVisitorStatsRecord(sheet, index + 1, activeHeaders, nextRecord);
    return nextRecord;
  }

  const firstRecord = {
    visitorId: siteView.visitorId,
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    lastPath: siteView.path,
    lastPathAt: nowIso,
    totalViews: 1,
    dateKeys: periods.dateKey,
    monthKeys: periods.monthKey,
    yearKeys: periods.yearKey,
    updatedAt: nowIso
  };

  sheet.appendRow(activeHeaders.map((header) => firstRecord[header] || ""));
  return firstRecord;
}

function createVisitorStatsRecordFromRow(row, activeHeaders) {
  return activeHeaders.reduce((record, header, index) => {
    record[header] = normalizeCell(row[index]);
    return record;
  }, {});
}

function writeVisitorStatsRecord(sheet, rowNumber, activeHeaders, record) {
  const values = activeHeaders.map((header) =>
    record[header] === undefined || record[header] === null ? "" : record[header]
  );
  sheet.getRange(rowNumber, 1, 1, activeHeaders.length).setValues([values]);
}

function computeVisitorStats(sheet, now) {
  const activeHeaders = getActiveHeaders(sheet, VISITOR_STATS_HEADERS);
  const rows =
    sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, activeHeaders.length).getValues() : [];
  const periods = getSiteViewPeriodKeys(now);
  const yesterdayKey = getSiteViewDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const visitorIdIndex = activeHeaders.indexOf("visitorId");
  const lastSeenAtIndex = activeHeaders.indexOf("lastSeenAt");
  const totalViewsIndex = activeHeaders.indexOf("totalViews");
  const dateKeysIndex = activeHeaders.indexOf("dateKeys");
  const monthKeysIndex = activeHeaders.indexOf("monthKeys");
  const yearKeysIndex = activeHeaders.indexOf("yearKeys");
  const seenVisitorIds = {};
  let usersToday = 0;
  let usersYesterday = 0;
  let usersThisMonth = 0;
  let usersThisYear = 0;
  let totalUsers = 0;
  let totalViews = 0;
  let onlineUsers = 0;
  let latestUpdatedAt = "";
  let latestUpdatedAtMs = 0;

  rows.forEach((row) => {
    const visitorId = String(row[visitorIdIndex] || "").trim();

    if (!isValidSiteViewVisitorId(visitorId) || seenVisitorIds[visitorId]) {
      return;
    }

    seenVisitorIds[visitorId] = true;
    totalUsers += 1;
    totalViews += normalizeVisitorStatsNumber(row[totalViewsIndex]);

    const dateKeys = splitVisitorPeriodKeys(row[dateKeysIndex]);
    const monthKeys = splitVisitorPeriodKeys(row[monthKeysIndex]);
    const yearKeys = splitVisitorPeriodKeys(row[yearKeysIndex]);

    if (dateKeys.indexOf(periods.dateKey) !== -1) {
      usersToday += 1;
    }

    if (dateKeys.indexOf(yesterdayKey) !== -1) {
      usersYesterday += 1;
    }

    if (monthKeys.indexOf(periods.monthKey) !== -1) {
      usersThisMonth += 1;
    }

    if (yearKeys.indexOf(periods.yearKey) !== -1) {
      usersThisYear += 1;
    }

    const lastSeenAt = String(row[lastSeenAtIndex] || "");
    const lastSeenAtMs = Date.parse(lastSeenAt);

    if (Number.isFinite(lastSeenAtMs)) {
      if (now.getTime() - lastSeenAtMs <= SITE_VIEW_ONLINE_WINDOW_MS) {
        onlineUsers += 1;
      }

      if (lastSeenAtMs > latestUpdatedAtMs) {
        latestUpdatedAtMs = lastSeenAtMs;
        latestUpdatedAt = new Date(lastSeenAtMs).toISOString();
      }
    }
  });

  return {
    enabled: false,
    usersToday,
    usersYesterday,
    usersThisMonth,
    usersThisYear,
    totalUsers,
    totalViews,
    onlineUsers,
    updatedAt: latestUpdatedAt
  };
}

function splitVisitorPeriodKeys(value) {
  const seen = {};

  return String(value || "")
    .split("|")
    .map((key) => key.trim())
    .filter((key) => {
      if (!key || seen[key]) {
        return false;
      }

      seen[key] = true;
      return true;
    });
}

function addVisitorPeriodKey(value, key, limit) {
  const keys = splitVisitorPeriodKeys(value);

  if (keys.indexOf(key) === -1) {
    keys.push(key);
  }

  return keys.slice(Math.max(0, keys.length - limit)).join("|");
}

function getSiteViewPeriodKeys(date) {
  return {
    dateKey: getSiteViewDateKey(date),
    monthKey: formatSiteViewDate(date, "yyyy-MM"),
    yearKey: formatSiteViewDate(date, "yyyy")
  };
}

function getSiteViewDateKey(date) {
  return formatSiteViewDate(date, "yyyy-MM-dd");
}

function formatSiteViewDate(date, pattern) {
  try {
    if (typeof Utilities !== "undefined" && typeof Session !== "undefined" && Utilities.formatDate) {
      return Utilities.formatDate(date, Session.getScriptTimeZone() || "Asia/Bangkok", pattern);
    }
  } catch (error) {
    console.warn(`Unable to format site view date with Apps Script timezone: ${error.message || error}`);
  }

  const iso = date.toISOString();

  if (pattern === "yyyy") {
    return iso.slice(0, 4);
  }

  if (pattern === "yyyy-MM") {
    return iso.slice(0, 7);
  }

  return iso.slice(0, 10);
}

function createVisitorStatsHttpError(message, statusCode) {
  if (typeof createHttpError === "function") {
    return createHttpError(message, statusCode);
  }

  const error = new Error(message);
  error.statusCode = statusCode || 500;
  return error;
}

function ensureFolders() {
  const rootName = getSetting(SETTING_KEYS.rootFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.rootFolderName];
  const mediaFolderName =
    getSetting(SETTING_KEYS.mediaFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.mediaFolderName];
  const docsFolderName =
    getSetting(SETTING_KEYS.docsFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.docsFolderName];
  const rootFolder = getOrCreateFolder(rootName);
  const driveFolderId = getSetting(SETTING_KEYS.driveFolderId);
  const docsFolderId = getSetting(SETTING_KEYS.docsFolderId);
  const mediaFolder = resolveManagedFolder({
    rootFolder,
    folderId: driveFolderId,
    folderName: mediaFolderName
  });
  const docsFolder = resolveManagedFolder({
    rootFolder,
    folderId: docsFolderId,
    folderName: docsFolderName
  });

  setSetting(SETTING_KEYS.driveFolderId, mediaFolder.getId());
  setSetting(SETTING_KEYS.docsFolderId, docsFolder.getId());

  return {
    driveFolderId: mediaFolder.getId(),
    docsFolderId: docsFolder.getId()
  };
}

function resolveManagedFolder(input) {
  const existingFolder = input.folderId ? getFolderByIdSafe(input.folderId) : null;

  if (
    existingFolder &&
    existingFolder.getName() === input.folderName &&
    isFolderInsideParent(existingFolder, input.rootFolder.getId())
  ) {
    return existingFolder;
  }

  return getOrCreateChildFolder(input.rootFolder, input.folderName);
}

function getFolderByIdSafe(folderId) {
  if (!folderId) {
    return null;
  }

  try {
    return DriveApp.getFolderById(folderId);
  } catch (error) {
    console.warn(`Unable to open folder by id ${folderId}: ${error.message || error}`);
    return null;
  }
}

function isFolderInsideParent(folder, parentId) {
  if (!folder || !parentId) {
    return false;
  }

  const parents = folder.getParents();

  while (parents.hasNext()) {
    if (parents.next().getId() === parentId) {
      return true;
    }
  }

  return false;
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateChildFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function readObjects(sheet, headers) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const activeHeaders = getActiveHeaders(sheet, headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, activeHeaders.length).getValues();

  return values
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) =>
      headers.reduce((record, header) => {
        const sourceIndex = activeHeaders.indexOf(header);
        record[header] = sourceIndex === -1 ? "" : normalizeCell(row[sourceIndex]);
        return record;
      }, {})
    );
}

function getActiveHeaders(sheet, expectedHeaders) {
  const maxColumns = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  const activeHeaders = sheet.getRange(1, 1, 1, maxColumns).getValues()[0];

  expectedHeaders.forEach((header) => {
    if (activeHeaders.indexOf(header) === -1) {
      activeHeaders.push(header);
    }
  });

  return activeHeaders.filter((header) => header);
}

function normalizeCell(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function upsertRow(sheet, headers, item) {
  ensureSheet(getSpreadsheet(), sheet.getName(), headers);
  const rows = sheet.getDataRange().getValues();
  const activeHeaders = getActiveHeaders(sheet, headers);
  const idIndex = activeHeaders.indexOf("id");
  const targetRow = rows.findIndex((row, index) => index > 0 && row[idIndex] === item.id);
  const values = activeHeaders.map((header) => {
    const value = item[header];
    return value === undefined || value === null ? "" : value;
  });

  if (targetRow === -1) {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, activeHeaders.length).setValues([values]);
    return;
  }

  sheet.getRange(targetRow + 1, 1, 1, activeHeaders.length).setValues([values]);
}

function findRowById(sheet, headers, id) {
  if (!sheet || !id || sheet.getLastRow() < 2) {
    return null;
  }

  const activeHeaders = getActiveHeaders(sheet, headers);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, activeHeaders.length).getValues();
  const idIndex = activeHeaders.indexOf("id");
  const targetRow = rows.find((row) => row[idIndex] === id);

  if (!targetRow) {
    return null;
  }

  return headers.reduce((record, header) => {
    const sourceIndex = activeHeaders.indexOf(header);
    record[header] = sourceIndex === -1 ? "" : normalizeCell(targetRow[sourceIndex]);
    return record;
  }, {});
}

function deleteRowById(sheetName, headers, id) {
  if (!id) {
    throw new Error("Missing record id.");
  }

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  const rows = sheet.getDataRange().getValues();
  const activeHeaders = getActiveHeaders(sheet, headers);
  const idIndex = activeHeaders.indexOf("id");
  const targetRow = rows.findIndex((row, index) => index > 0 && row[idIndex] === id);

  if (targetRow === -1) {
    throw new Error(`Record not found: ${id}`);
  }

  sheet.deleteRow(targetRow + 1);
}

function buildMetrics(content, media) {
  const publishedCount = content.filter((item) => item.status === "published").length;
  const reviewCount = content.filter((item) => item.status === "review").length;
  const scheduledCount = content.filter((item) => item.status === "scheduled").length;
  const blogCount = content.filter((item) => item.type === "blog").length;

  return [
    {
      id: "published-pages",
      label: "เนื้อหาที่เผยแพร่",
      value: String(publishedCount),
      trend: `ตั้งเวลา ${scheduledCount} รายการ / บทความ ${blogCount} รายการ`,
      tone: "blue"
    },
    {
      id: "review-queue",
      label: "คิวรอตรวจสอบ",
      value: String(reviewCount),
      trend: "รอบบรรณาธิการตรวจสอบ",
      tone: "amber"
    },
    {
      id: "media-assets",
      label: "สื่อใน Drive",
      value: String(media.length),
      trend: "ซิงก์จากชีตสื่อ",
      tone: "green"
    },
    {
      id: "sync-health",
      label: "สถานะซิงก์",
      value: "100%",
      trend: "Apps Script ออนไลน์",
      tone: "red"
    }
  ];
}
