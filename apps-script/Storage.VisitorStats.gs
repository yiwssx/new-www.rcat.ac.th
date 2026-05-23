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
