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
  const folders = ensureFolders();
  ensureSettingsSheet(spreadsheet);
  ensureDefaultUsersSheet(spreadsheet);

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
    menu,
    displaySettings: getDisplaySettings()
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

