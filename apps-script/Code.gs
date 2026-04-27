const EDITOR_WRITE_RESOURCES = [
  "content",
  "content-delete",
  "media",
  "media-delete",
  "event",
  "event-delete",
  "publish",
  "menu",
  "language-source"
];

const ADMIN_ONLY_RESOURCES = ["users", "users-delete", "users-reset"];

const AUTH_SESSION_HOURS_FALLBACK = 8;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

function doGet(event) {
  return routeRequest(event, "GET");
}

function doPost(event) {
  return routeRequest(event, "POST");
}

function routeRequest(event, method) {
  try {
    ensureDefaultScriptProperties();
    ensureAuthTokenSecret();

    const resource = getResource(event);
    const payload = parsePayload(event);
    const query = getQueryParams(event);
    const authContext = getRequestAuthContext(payload, query);

    assertRouteAccess(method, resource, authContext);

    if (method === "GET" && resource === "snapshot") {
      return jsonResponse(
        getSnapshot({
          includeUnpublished: Boolean(authContext)
        })
      );
    }

    if (method === "GET" && resource === "health") {
      return jsonResponse({
        ok: true,
        hasSpreadsheet: Boolean(getSetting(SETTING_KEYS.spreadsheetId)),
        hasDriveFolder: Boolean(getSetting(SETTING_KEYS.driveFolderId)),
        hasDocsFolder: Boolean(getSetting(SETTING_KEYS.docsFolderId)),
        timestamp: new Date().toISOString()
      });
    }

    if (method === "GET" && resource === "menu") {
      return jsonResponse({
        items: getMenu()
      });
    }

    if (method === "GET" && resource === "content-detail") {
      return jsonResponse(
        getContentDetail(query, {
          includeUnpublished: Boolean(authContext)
        })
      );
    }

    if (method === "GET" && resource === "users") {
      return jsonResponse({
        items: getUsers()
      });
    }

    if (method === "GET" && resource === "language-source") {
      return jsonResponse({
        items: getLanguageSourceItems()
      });
    }

    if (method === "POST" && resource === "auth-login") {
      return jsonResponse(loginUser(payload));
    }

    if (method === "POST" && resource === "content") {
      return jsonResponse(upsertContent(payload));
    }

    if (method === "POST" && resource === "content-delete") {
      return jsonResponse(deleteContent(payload.id));
    }

    if (method === "POST" && resource === "media") {
      return jsonResponse(upsertMedia(payload));
    }

    if (method === "POST" && resource === "media-delete") {
      return jsonResponse(deleteMedia(payload.id, payload.deleteDriveFile !== false));
    }

    if (method === "POST" && resource === "event") {
      return jsonResponse(upsertEvent(payload));
    }

    if (method === "POST" && resource === "event-delete") {
      return jsonResponse(deleteEvent(payload.id));
    }

    if (method === "POST" && resource === "publish") {
      return jsonResponse(publishContent(payload.id));
    }

    if (method === "POST" && resource === "menu") {
      return jsonResponse({
        items: replaceMenu(payload.items || [])
      });
    }

    if (method === "POST" && resource === "users") {
      return jsonResponse(upsertUser(payload));
    }

    if (method === "POST" && resource === "users-delete") {
      return jsonResponse(deleteUser(payload.id));
    }

    if (method === "POST" && resource === "users-reset") {
      return jsonResponse({
        items: resetUsers()
      });
    }

    if (method === "POST" && resource === "language-source") {
      return jsonResponse({
        items: replaceLanguageSource(payload.items || [])
      });
    }

    return jsonResponse(
      {
        error: "Unknown route",
        resource,
        method
      },
      404
    );
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    console.error(error);
    return jsonResponse(
      {
        error: error.message || String(error)
      },
      statusCode
    );
  }
}

function assertRouteAccess(method, resource, authContext) {
  if (method === "POST" && resource === "auth-login") {
    return;
  }

  if (method === "GET" && (resource === "snapshot" || resource === "health" || resource === "menu")) {
    return;
  }

  if (method === "GET" && resource === "content-detail") {
    return;
  }

  if (method === "GET" && resource === "language-source") {
    return;
  }

  if (method === "GET" && resource === "users") {
    requireMinimumRole(authContext, "admin");
    return;
  }

  if (method === "POST" && ADMIN_ONLY_RESOURCES.indexOf(resource) !== -1) {
    requireMinimumRole(authContext, "admin");
    return;
  }

  if (method === "POST" && EDITOR_WRITE_RESOURCES.indexOf(resource) !== -1) {
    requireMinimumRole(authContext, "editor");
  }
}

function requireMinimumRole(authContext, requiredRole) {
  if (!authContext || !authContext.user) {
    throw createHttpError("Authentication is required.", 401);
  }

  const currentRank = getRoleRank(authContext.user.role);
  const requiredRank = getRoleRank(requiredRole);

  if (currentRank < requiredRank) {
    throw createHttpError("You do not have permission for this action.", 403);
  }
}

function getRoleRank(role) {
  if (role === "admin") {
    return 2;
  }

  if (role === "editor") {
    return 1;
  }

  return 0;
}

function getRequestAuthContext(payload, query) {
  const token = extractAuthToken(payload, query);

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

function extractAuthToken(payload, query) {
  const payloadToken = payload && payload.authToken ? String(payload.authToken) : "";
  const queryToken = query && query.authToken ? String(query.authToken) : "";
  return payloadToken || queryToken || "";
}

function ensureAuthTokenSecret() {
  const currentSecret = getSetting(SETTING_KEYS.authTokenSecret);

  if (currentSecret) {
    return currentSecret;
  }

  const generated = `${Utilities.getUuid().replace(/-/g, "")}${Utilities.getUuid().replace(/-/g, "")}`;
  setSetting(SETTING_KEYS.authTokenSecret, generated);
  return generated;
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode || 500;
  return error;
}

function getErrorStatusCode(error) {
  if (!error || typeof error.statusCode !== "number") {
    return 500;
  }

  return error.statusCode;
}

function setupCmsBackend() {
  ensureDefaultScriptProperties();
  ensureAuthTokenSecret();

  const spreadsheetId = getSetting(SETTING_KEYS.spreadsheetId);
  const spreadsheetName = getSetting(SETTING_KEYS.spreadsheetName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.spreadsheetName];
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.create(spreadsheetName);

  setSetting(SETTING_KEYS.spreadsheetId, spreadsheet.getId());

  ensureSheet(spreadsheet, SHEETS.content, CONTENT_HEADERS);
  ensureSheet(spreadsheet, SHEETS.media, MEDIA_HEADERS);
  ensureSheet(spreadsheet, SHEETS.events, EVENT_HEADERS);
  ensureSheet(spreadsheet, SHEETS.menu, MENU_HEADERS);
  ensureSheet(spreadsheet, SHEETS.users, USER_HEADERS);
  ensureSheet(spreadsheet, SHEETS.language, LANGUAGE_HEADERS);
  const folders = ensureFolders();
  ensureSettingsSheet(spreadsheet);
  ensureDefaultUsersSheet(spreadsheet);
  ensureDefaultLanguageSheet(spreadsheet);

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    driveFolderId: folders.driveFolderId,
    docsFolderId: folders.docsFolderId
  };
}

function getSnapshot(options) {
  const config = options || {};
  const includeUnpublished = Boolean(config.includeUnpublished);
  const spreadsheet = getSpreadsheet();
  const content = readObjects(spreadsheet.getSheetByName(SHEETS.content), CONTENT_HEADERS).map(normalizeContentRecord);
  const media = readObjects(spreadsheet.getSheetByName(SHEETS.media), MEDIA_HEADERS);
  const events = readObjects(spreadsheet.getSheetByName(SHEETS.events), EVENT_HEADERS);
  const menu = getMenu();
  const visibleContent = includeUnpublished ? content : content.filter((item) => item.status === "published");
  const visibleEvents = includeUnpublished
    ? events
    : events.filter((event) => event.visibility !== "private" && event.status !== "cancelled");
  const visibleMedia = includeUnpublished ? media : filterMediaForPublicSnapshot(media, visibleContent);

  return {
    metrics: buildMetrics(visibleContent, visibleMedia),
    content: visibleContent,
    media: visibleMedia,
    events: visibleEvents,
    menu
  };
}

function filterMediaForPublicSnapshot(media, content) {
  const allowedIds = {};

  content.forEach((item) => {
    if (item.featuredMediaId) {
      allowedIds[item.featuredMediaId] = true;
    }

    normalizeMediaIds(item.mediaIds).forEach((id) => {
      allowedIds[id] = true;
    });
  });

  return media.filter((asset) => Boolean(allowedIds[asset.id]));
}

function upsertContent(item) {
  validateRequired(item, ["title", "slug", "type", "status", "owner"]);

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.content);
  const existingItem = item.id ? findRowById(sheet, CONTENT_HEADERS, item.id) : null;
  const contentId = item.id || `content-${Date.now()}`;
  const normalizedBody = item.body || "";
  const normalizedTags = normalizeTags(item.tags);
  const normalizedCategory = normalizeCategoryValue(item.category);
  const readingMinutes = resolveReadingMinutes(item.readingMinutes, normalizedBody || item.summary || item.title);
  const documentRecord = upsertContentBodyDocument({
    id: contentId,
    title: item.title,
    body: normalizedBody,
    existingDocId: existingItem ? existingItem.bodyDocId : ""
  });
  const nextItem = {
    id: contentId,
    title: item.title,
    slug: item.slug,
    type: item.type,
    status: item.status,
    owner: item.owner,
    summary: item.summary || "",
    category: normalizedCategory,
    tags: normalizedTags.join(","),
    seoTitle: item.seoTitle || "",
    seoDescription: item.seoDescription || "",
    canonicalUrl: item.canonicalUrl || "",
    featured: toSheetBoolean(item.featured),
    readingMinutes,
    template: item.template || "standard",
    body: "",
    bodyDocId: documentRecord.id,
    bodyDocUrl: documentRecord.url,
    featuredMediaId: item.featuredMediaId || "",
    mediaIds: normalizeMediaIds(item.mediaIds).join(","),
    updatedAt: new Date().toISOString(),
    publishAt: item.publishAt || new Date().toISOString()
  };

  upsertRow(sheet, CONTENT_HEADERS, nextItem);
  return normalizeContentRecord({
    ...nextItem,
    body: normalizedBody
  });
}

function deleteContent(id) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.content);
  const item = findRowById(sheet, CONTENT_HEADERS, id);

  if (item && item.bodyDocId) {
    try {
      DriveApp.getFileById(item.bodyDocId).setTrashed(true);
    } catch (error) {
      console.warn(`Unable to trash Google Doc ${item.bodyDocId}: ${error.message || error}`);
    }
  }

  deleteRowById(SHEETS.content, CONTENT_HEADERS, id);

  return {
    id,
    deleted: true
  };
}

function getContentDetail(query, options) {
  const config = options || {};
  const includeUnpublished = Boolean(config.includeUnpublished);
  const spreadsheet = getSpreadsheet();
  const rows = readObjects(spreadsheet.getSheetByName(SHEETS.content), CONTENT_HEADERS);
  const id = query.id || "";
  const slug = query.slug || "";
  const item = rows.find((row) => (id && row.id === id) || (slug && row.slug === slug));

  if (!item) {
    throw createHttpError("Content item not found.", 404);
  }

  if (!includeUnpublished && item.status !== "published") {
    throw createHttpError("Content item not found.", 404);
  }

  return normalizeContentRecord(item, {
    includeBody: true
  });
}

function upsertMedia(asset) {
  validateRequired(asset, ["name", "type", "owner"]);

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.media);
  const uploadedFile = asset.fileBase64 ? createDriveFile(asset) : null;
  const driveUrl = uploadedFile ? uploadedFile.getUrl() : asset.driveUrl || "";
  const fileId = uploadedFile ? uploadedFile.getId() : asset.fileId || extractDriveFileId(driveUrl);
  const mimeType = uploadedFile ? uploadedFile.getMimeType() : asset.mimeType || "";
  const previewUrl = asset.previewUrl || buildPreviewUrl(fileId, asset.type);
  const embedUrl = asset.embedUrl || buildEmbedUrl(fileId);
  const nextAsset = {
    id: asset.id || `media-${Date.now()}`,
    name: asset.name,
    type: asset.type,
    size: uploadedFile ? formatBytes(uploadedFile.getSize()) : asset.size || "",
    owner: asset.owner,
    driveUrl,
    fileId,
    mimeType,
    previewUrl,
    embedUrl,
    updatedAt: new Date().toISOString()
  };

  upsertRow(sheet, MEDIA_HEADERS, nextAsset);
  return nextAsset;
}

function deleteMedia(id, deleteDriveFile) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.media);
  const asset = findRowById(sheet, MEDIA_HEADERS, id);

  if (deleteDriveFile && asset && asset.fileId) {
    try {
      DriveApp.getFileById(asset.fileId).setTrashed(true);
    } catch (error) {
      console.warn(`Unable to trash Drive file ${asset.fileId}: ${error.message || error}`);
    }
  }

  deleteRowById(SHEETS.media, MEDIA_HEADERS, id);

  return {
    id,
    deleted: true
  };
}

function upsertEvent(event) {
  validateRequired(event, ["title", "date", "audience", "status"]);
  validateEventDateRange(event.date, event.endDate);

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.events);
  const nextEvent = {
    id: event.id || `event-${Date.now()}`,
    title: event.title,
    date: event.date,
    endDate: event.endDate || "",
    audience: event.audience,
    status: event.status,
    location: event.location || "",
    description: event.description || "",
    category: event.category || "",
    visibility: event.visibility || "public",
    updatedAt: new Date().toISOString()
  };

  upsertRow(sheet, EVENT_HEADERS, nextEvent);
  return nextEvent;
}

function deleteEvent(id) {
  deleteRowById(SHEETS.events, EVENT_HEADERS, id);

  return {
    id,
    deleted: true
  };
}

function publishContent(id) {
  if (!id) {
    throw new Error("Missing content id.");
  }

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.content);
  const rows = sheet.getDataRange().getValues();
  const idIndex = CONTENT_HEADERS.indexOf("id");
  const statusIndex = CONTENT_HEADERS.indexOf("status");
  const updatedIndex = CONTENT_HEADERS.indexOf("updatedAt");

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index][idIndex] === id) {
      sheet.getRange(index + 1, statusIndex + 1).setValue("published");
      sheet.getRange(index + 1, updatedIndex + 1).setValue(new Date().toISOString());
      return {
        id,
        published: true
      };
    }
  }

  throw new Error(`Content item not found: ${id}`);
}

function normalizeContentRecord(item, options) {
  const config = options || {};
  const includeBody = Boolean(config.includeBody);
  const documentBody = includeBody ? readContentBody(item.bodyDocId) : "";
  const bodyValue = includeBody ? documentBody || item.body || "" : "";
  const readingMinutes = resolveReadingMinutes(
    item.readingMinutes,
    bodyValue || item.summary || item.title
  );

  return {
    ...item,
    body: bodyValue,
    category: normalizeCategoryValue(item.category),
    tags: normalizeTags(item.tags),
    seoTitle: item.seoTitle || "",
    seoDescription: item.seoDescription || "",
    canonicalUrl: item.canonicalUrl || "",
    featured: normalizeSheetBoolean(item.featured),
    readingMinutes,
    template: item.template || "standard",
    bodyDocId: item.bodyDocId || "",
    bodyDocUrl: item.bodyDocUrl || "",
    featuredMediaId: item.featuredMediaId || "",
    mediaIds: normalizeMediaIds(item.mediaIds)
  };
}

function resolveReadingMinutes(value, text) {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.ceil(numericValue);
  }

  return estimateReadingMinutes(text);
}

function estimateReadingMinutes(text) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (!words) {
    return 1;
  }

  return Math.max(1, Math.ceil(words / 220));
}

function normalizeTags(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
      .filter((tag, index, tags) => tags.indexOf(tag) === index);
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
        .filter((tag, index, tags) => tags.indexOf(tag) === index);
    }
  } catch (error) {
    // Fall back to comma-separated values.
  }

  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function normalizeCategoryValue(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index)
    .join(", ");
}

function normalizeSheetBoolean(value) {
  return value === true || value === "TRUE" || value === "true";
}

function toSheetBoolean(value) {
  return normalizeSheetBoolean(value) ? "TRUE" : "FALSE";
}

function normalizeMediaIds(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean);
    }
  } catch (error) {
    // Fall back to comma-separated sheet values.
  }

  return String(value)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function upsertContentBodyDocument(input) {
  const docsFolder = resolveContentDocsFolder();
  const existingDocId = input.existingDocId || "";
  let document = null;
  let createdNewDocument = false;

  if (existingDocId) {
    try {
      document = DocumentApp.openById(existingDocId);
    } catch (error) {
      console.warn(`Unable to open existing Google Doc ${existingDocId}: ${error.message || error}`);
    }
  }

  if (!document) {
    document = DocumentApp.create(buildContentDocumentName(input.title, input.id));
    createdNewDocument = true;
  }

  const body = document.getBody();
  body.clear();
  body.appendParagraph(input.body || "");
  document.saveAndClose();

  const file = DriveApp.getFileById(document.getId());
  if (createdNewDocument) {
    ensureFileInFolder(file, docsFolder);
  }

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    id: document.getId(),
    url: file.getUrl()
  };
}

function buildContentDocumentName(title, id) {
  const safeTitle = String(title || "Untitled Content").trim();
  return `${safeTitle} (${id})`;
}

function ensureFileInFolder(file, folder) {
  if (!folder || !file) {
    return;
  }

  const parents = file.getParents();
  let existsInFolder = false;

  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) {
      existsInFolder = true;
      break;
    }
  }

  if (!existsInFolder) {
    folder.addFile(file);
  }
}

function readContentBody(docId) {
  if (!docId) {
    return "";
  }

  try {
    return DocumentApp.openById(docId).getBody().getText() || "";
  } catch (error) {
    console.warn(`Unable to read Google Doc ${docId}: ${error.message || error}`);
    return "";
  }
}

function createDriveFile(asset) {
  const uploadFolder = resolveMediaUploadFolder();
  const bytes = Utilities.base64Decode(stripDataUrlPrefix(asset.fileBase64));
  const fileName = asset.fileName || asset.name;
  const contentType = asset.mimeType || "application/octet-stream";
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  const file = uploadFolder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}

function resolveMediaUploadFolder() {
  const folders = ensureFolders();
  return DriveApp.getFolderById(folders.driveFolderId);
}

function resolveContentDocsFolder() {
  const folders = ensureFolders();
  return DriveApp.getFolderById(folders.docsFolderId);
}

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:[^;]+;base64,/, "");
}

function extractDriveFileId(url) {
  if (!url) {
    return "";
  }

  const patterns = [/\/file\/d\/([^/]+)/, /[?&]id=([^&]+)/, /\/d\/([^/]+)/];

  for (let index = 0; index < patterns.length; index += 1) {
    const match = String(url).match(patterns[index]);

    if (match && match[1]) {
      return match[1];
    }
  }

  return "";
}

function buildPreviewUrl(fileId, type) {
  if (!fileId) {
    return "";
  }

  if (type === "image") {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  }

  return buildEmbedUrl(fileId);
}

function buildEmbedUrl(fileId) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : "";
}

function formatBytes(size) {
  if (!size) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getMenu() {
  const spreadsheet = getSpreadsheet();
  const rows = readObjects(spreadsheet.getSheetByName(SHEETS.menu), MENU_HEADERS);
  const itemMap = {};
  const rootItems = [];

  rows
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .forEach((row) => {
      itemMap[row.id] = {
        id: row.id,
        label: {
          th: row.labelTh || "",
          en: row.labelEn || ""
        },
        href: row.href || "/",
        enabled: row.enabled === true || row.enabled === "TRUE" || row.enabled === "true",
        children: []
      };
    });

  rows
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .forEach((row) => {
      const item = itemMap[row.id];

      if (!item) {
        return;
      }

      if (row.parentId && itemMap[row.parentId]) {
        itemMap[row.parentId].children.push(item);
        return;
      }

      rootItems.push(item);
    });

  return cleanMenuChildren(rootItems);
}

function cleanMenuChildren(items) {
  return items.map((item) => {
    const nextItem = {
      id: item.id,
      label: item.label,
      href: item.href,
      enabled: item.enabled
    };

    if (item.children && item.children.length) {
      nextItem.children = cleanMenuChildren(item.children);
    }

    return nextItem;
  });
}

function replaceMenu(items) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.menu);
  const rows = [];

  flattenMenuItems(items, "", rows);

  sheet.clear();
  sheet.getRange(1, 1, 1, MENU_HEADERS.length).setValues([MENU_HEADERS]);
  sheet.setFrozenRows(1);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, MENU_HEADERS.length).setValues(rows);
  }

  return getMenu();
}

function getUsers() {
  return getUsersWithPasswordHashes().map(sanitizeUserRecord);
}

function getUsersWithPasswordHashes() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.users);
  let users = readObjects(sheet, USER_HEADERS);

  if (!users.length && hasBootstrapAdminCredentials()) {
    upsertRow(sheet, USER_HEADERS, buildDefaultAdminUser());
    users = readObjects(sheet, USER_HEADERS);
  }

  return users.map((user) => ({
    ...user,
    email: String(user.email || "").trim().toLowerCase(),
    role: user.role || "viewer",
    status: user.status || "active"
  }));
}

function sanitizeUserRecord(user) {
  return {
    id: user.id,
    name: user.name,
    email: String(user.email || "").trim().toLowerCase(),
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt || "",
    updatedAt: user.updatedAt || ""
  };
}

function ensureDefaultUsersSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SHEETS.users);

  if (!sheet || sheet.getLastRow() > 1 || !hasBootstrapAdminCredentials()) {
    return;
  }

  const admin = buildDefaultAdminUser();
  upsertRow(sheet, USER_HEADERS, admin);
}

function buildDefaultAdminUser() {
  const email = String(getSetting(SETTING_KEYS.defaultAdminEmail) || "").trim().toLowerCase();
  const passwordHash = String(getSetting(SETTING_KEYS.defaultAdminPasswordHash) || "").trim();

  if (!email || !passwordHash) {
    throw new Error(
      "Default admin is not configured. Set Script Properties defaultAdminEmail and defaultAdminPasswordHash."
    );
  }

  const now = new Date().toISOString();
  return {
    id: "user-admin",
    name: String(getSetting(SETTING_KEYS.defaultAdminName) || "Administrator").trim() || "Administrator",
    email,
    role: "admin",
    status: "active",
    passwordHash,
    avatarUrl: "",
    createdAt: now,
    updatedAt: now
  };
}

function hasBootstrapAdminCredentials() {
  const email = String(getSetting(SETTING_KEYS.defaultAdminEmail) || "").trim();
  const passwordHash = String(getSetting(SETTING_KEYS.defaultAdminPasswordHash) || "").trim();

  return Boolean(email && passwordHash);
}

function loginUser(input) {
  validateRequired(input, ["email", "password"]);

  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  assertLoginAttemptsAllowed(email);
  const user = getUsersWithPasswordHashes().find((item) => item.email === email);

  if (!user || user.status !== "active") {
    registerFailedLoginAttempt(email);
    throw createHttpError("Invalid email or password.", 401);
  }

  let passwordMatches = false;
  try {
    passwordMatches = verifyPasswordHash(password, user.passwordHash);
  } catch (error) {
    registerFailedLoginAttempt(email);
    throw error;
  }

  if (!passwordMatches) {
    registerFailedLoginAttempt(email);
    throw createHttpError("Invalid email or password.", 401);
  }

  clearFailedLoginAttempts(email);
  return buildAuthSession(user);
}

function buildAuthSession(user) {
  const configuredHours = Number(getSetting(SETTING_KEYS.authSessionHours) || AUTH_SESSION_HOURS_FALLBACK);
  const sessionHours = configuredHours > 0 ? configuredHours : AUTH_SESSION_HOURS_FALLBACK;
  const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);

  return {
    user: sanitizeUserRecord(user),
    token: createAuthToken(user, expiresAt),
    expiresAt: expiresAt.toISOString()
  };
}

function loginRateLimitCacheKey(email) {
  return `cms:login-fail:${String(email || "").trim().toLowerCase()}`;
}

function assertLoginAttemptsAllowed(email) {
  const cacheKey = loginRateLimitCacheKey(email);
  const attemptsRaw = CacheService.getScriptCache().get(cacheKey);
  const attempts = Number(attemptsRaw || "0");

  if (attempts >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    throw createHttpError("Too many login attempts. Please wait and try again.", 429);
  }
}

function registerFailedLoginAttempt(email) {
  const cache = CacheService.getScriptCache();
  const cacheKey = loginRateLimitCacheKey(email);
  const attemptsRaw = cache.get(cacheKey);
  const attempts = Number(attemptsRaw || "0") + 1;
  cache.put(cacheKey, String(attempts), LOGIN_RATE_LIMIT_WINDOW_SECONDS);
}

function clearFailedLoginAttempts(email) {
  const cacheKey = loginRateLimitCacheKey(email);
  CacheService.getScriptCache().remove(cacheKey);
}

function createAuthToken(user, expiresAt) {
  const header = base64UrlEncodeJson({
    alg: "HS256",
    typ: "JWT"
  });
  const payload = base64UrlEncodeJson({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Math.floor(expiresAt.getTime() / 1000)
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = signAuthToken(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

function verifyAuthToken(token) {
  const parts = String(token || "").split(".");

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw createHttpError("Invalid session token.", 401);
  }

  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const expectedSignature = signAuthToken(unsignedToken);

  if (!constantTimeEquals(parts[2], expectedSignature)) {
    throw createHttpError("Invalid session token.", 401);
  }

  const claims = parseBase64UrlJson(parts[1]);
  if (!claims || !claims.sub || !claims.email || !claims.exp) {
    throw createHttpError("Invalid session token.", 401);
  }

  if (Number(claims.exp) * 1000 <= Date.now()) {
    throw createHttpError("Session expired. Please sign in again.", 401);
  }

  const normalizedEmail = String(claims.email || "").trim().toLowerCase();
  const user = getUsersWithPasswordHashes().find((item) => item.id === claims.sub && item.email === normalizedEmail);

  if (!user || user.status !== "active") {
    throw createHttpError("Session user is no longer active.", 401);
  }

  return {
    user: sanitizeUserRecord(user),
    claims
  };
}

function signAuthToken(unsignedToken) {
  const signature = Utilities.computeHmacSha256Signature(
    unsignedToken,
    ensureAuthTokenSecret(),
    Utilities.Charset.UTF_8
  );

  return base64UrlEncodeBytes(signature);
}

function base64UrlEncodeJson(value) {
  const json = JSON.stringify(value);
  return Utilities.base64EncodeWebSafe(json, Utilities.Charset.UTF_8).replace(/=+$/g, "");
}

function base64UrlEncodeBytes(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, "");
}

function parseBase64UrlJson(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(value + padding)).getDataAsString();

  try {
    return JSON.parse(json);
  } catch (error) {
    throw createHttpError("Invalid session token.", 401);
  }
}

function constantTimeEquals(left, right) {
  const leftValue = String(left || "");
  const rightValue = String(right || "");

  if (leftValue.length !== rightValue.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < leftValue.length; index += 1) {
    diff |= leftValue.charCodeAt(index) ^ rightValue.charCodeAt(index);
  }

  return diff === 0;
}

function createPasswordHash(password) {
  const salt = Utilities.getUuid().replace(/-/g, "");
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${salt}:${String(password || "")}`,
    Utilities.Charset.UTF_8
  );

  return `sha256$${salt}$${base64UrlEncodeBytes(digest)}`;
}

function verifyPasswordHash(password, storedHash) {
  const normalizedHash = String(storedHash || "").trim();

  if (!normalizedHash) {
    return false;
  }

  if (normalizedHash.indexOf("sha256$") === 0) {
    const segments = normalizedHash.split("$");

    if (segments.length !== 3) {
      return false;
    }

    const salt = segments[1];
    const expectedDigest = segments[2];
    const computedDigest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      `${salt}:${String(password || "")}`,
      Utilities.Charset.UTF_8
    );

    return constantTimeEquals(base64UrlEncodeBytes(computedDigest), expectedDigest);
  }

  if (normalizedHash.indexOf("$2") === 0) {
    throw createHttpError(
      "This account uses a legacy password hash. Reset the password from the CMS user manager.",
      401
    );
  }

  return false;
}

function upsertUser(user) {
  validateRequired(user, ["name", "email", "role", "status"]);

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.users);
  const users = getUsersWithPasswordHashes();
  const id = user.id || `user-${Date.now()}`;
  const normalizedEmail = String(user.email || "").trim().toLowerCase();
  const duplicateUser = users.find((item) => item.email === normalizedEmail && item.id !== id);

  if (duplicateUser) {
    throw new Error("A user with this email already exists.");
  }

  const existingUser = users.find((item) => item.id === id);
  const plainPassword = String(user.password || "").trim();
  const explicitPasswordHash = String(user.passwordHash || "").trim();
  let passwordHash = existingUser ? String(existingUser.passwordHash || "") : "";

  if (plainPassword) {
    passwordHash = createPasswordHash(plainPassword);
  } else if (explicitPasswordHash) {
    if (explicitPasswordHash.indexOf("sha256$") !== 0) {
      throw new Error("Only sha256 password hashes are accepted. Use password instead.");
    }

    passwordHash = explicitPasswordHash;
  }

  if (!passwordHash) {
    throw new Error("Password is required for new users.");
  }

  const nextUser = {
    id,
    name: user.name,
    email: normalizedEmail,
    role: user.role,
    status: user.status,
    passwordHash,
    avatarUrl: user.avatarUrl || (existingUser ? existingUser.avatarUrl : ""),
    createdAt: existingUser ? existingUser.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  upsertRow(sheet, USER_HEADERS, nextUser);
  return sanitizeUserRecord(nextUser);
}

function deleteUser(id) {
  if (!id) {
    throw new Error("Missing user id.");
  }

  const users = getUsersWithPasswordHashes();
  const target = users.find((user) => user.id === id);

  if (!target) {
    return {
      id,
      deleted: false
    };
  }

  const activeAdmins = users.filter((user) => user.role === "admin" && user.status === "active");

  if (target.role === "admin" && target.status === "active" && activeAdmins.length <= 1) {
    throw new Error("At least one active administrator is required.");
  }

  deleteRowById(SHEETS.users, USER_HEADERS, id);
  return {
    id,
    deleted: true
  };
}

function resetUsers() {
  if (!hasBootstrapAdminCredentials()) {
    throw new Error(
      "Cannot reset users because default admin credentials are not configured in Script Properties."
    );
  }

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.users);
  const admin = buildDefaultAdminUser();

  sheet.clear();
  sheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, 1, USER_HEADERS.length).setValues([
    USER_HEADERS.map((header) => admin[header] || "")
  ]);

  return getUsers();
}

function ensureDefaultLanguageSheet(spreadsheet) {
  ensureSheet(spreadsheet, SHEETS.language, LANGUAGE_HEADERS);
}

function getLanguageSourceItems() {
  const spreadsheet = getSpreadsheet();
  return readObjects(spreadsheet.getSheetByName(SHEETS.language), LANGUAGE_HEADERS)
    .filter((item) => item.key)
    .map((item) => ({
      key: item.key,
      th: item.th || "",
      en: item.en || "",
      updatedAt: item.updatedAt || ""
    }))
    .sort((left, right) => String(left.key).localeCompare(String(right.key)));
}

function replaceLanguageSource(items) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.language);
  const rows = [];

  items.forEach((item) => {
    validateRequired(item, ["key"]);
    rows.push([item.key, item.th || "", item.en || "", new Date().toISOString()]);
  });

  sheet.clear();
  sheet.getRange(1, 1, 1, LANGUAGE_HEADERS.length).setValues([LANGUAGE_HEADERS]);
  sheet.setFrozenRows(1);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, LANGUAGE_HEADERS.length).setValues(rows);
  }

  return getLanguageSourceItems();
}

function flattenMenuItems(items, parentId, rows) {
  items.forEach((item, index) => {
    validateRequired(item, ["id", "href"]);

    if (!item.label || !item.label.th || !item.label.en) {
      throw new Error("Each menu item needs TH and EN labels.");
    }

    rows.push([
      item.id,
      parentId,
      item.label.th,
      item.label.en,
      item.href,
      index,
      item.enabled === false ? "FALSE" : "TRUE"
    ]);

    if (item.children && item.children.length) {
      flattenMenuItems(item.children, item.id, rows);
    }
  });
}

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
  const currentHeaders = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, maxColumns).getValues()[0].filter((header) => header)
    : [];

  if (!currentHeaders.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const mergedHeaders = headers.concat(currentHeaders.filter((header) => headers.indexOf(header) === -1));
  const hasHeaders = mergedHeaders.every((header, index) => currentHeaders[index] === header);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
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
    }
  ];

  settings.forEach((setting) => upsertSetting(sheet, setting.key, setting.value));
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

function ensureFolders() {
  const rootName = getSetting(SETTING_KEYS.rootFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.rootFolderName];
  const mediaFolderName = getSetting(SETTING_KEYS.mediaFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.mediaFolderName];
  const docsFolderName = getSetting(SETTING_KEYS.docsFolderName) || DEFAULT_SCRIPT_PROPERTIES[SETTING_KEYS.docsFolderName];
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
      label: "Published content",
      value: String(publishedCount),
      trend: `${scheduledCount} scheduled / ${blogCount} blog`,
      tone: "blue"
    },
    {
      id: "review-queue",
      label: "Review queue",
      value: String(reviewCount),
      trend: "Needs editorial review",
      tone: "amber"
    },
    {
      id: "media-assets",
      label: "Drive assets",
      value: String(media.length),
      trend: "Synced from media sheet",
      tone: "green"
    },
    {
      id: "sync-health",
      label: "Sync health",
      value: "100%",
      trend: "Apps Script online",
      tone: "red"
    }
  ];
}

function getResource(event) {
  return (event.parameter && event.parameter.resource) || "snapshot";
}

function getQueryParams(event) {
  return (event && event.parameter) || {};
}

function parsePayload(event) {
  if (!event.postData || !event.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(event.postData.contents);
  } catch (error) {
    throw new Error("Request body must be valid JSON.");
  }
}

function validateRequired(value, keys) {
  keys.forEach((key) => {
    if (!value[key]) {
      throw new Error(`Missing required field: ${key}`);
    }
  });
}

function validateEventDateRange(startDateValue, endDateValue) {
  const startDate = parseEventDateValue(startDateValue, "start date");

  if (!endDateValue) {
    return;
  }

  const endDate = parseEventDateValue(endDateValue, "end date");
  const startDay = formatDateKey(startDate);
  const endDay = formatDateKey(endDate);

  if (endDay < startDay) {
    throw new Error("End date must be the same as or after the start date.");
  }
}

function parseEventDateValue(value, label) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid ${label}.`);
  }

  return parsedDate;
}

function formatDateKey(dateValue) {
  return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function jsonResponse(payload, statusCode) {
  const output = ContentService.createTextOutput(
    JSON.stringify({
      ...payload,
      statusCode: statusCode || 200
    })
  );

  return output.setMimeType(ContentService.MimeType.JSON);
}
