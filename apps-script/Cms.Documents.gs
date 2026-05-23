const ALLOWED_DOCUMENT_STATUSES = ["draft", "published"];

function getPublicDocumentListSnapshot() {
  return {
    items: getPublicDocuments(),
    generatedAt: new Date().toISOString()
  };
}

function getDocuments(options) {
  const config = options || {};
  const includeDrafts = Boolean(config.includeDrafts);
  const spreadsheet = getSpreadsheet();
  const sheet =
    spreadsheet.getSheetByName(SHEETS.documents) || ensureSheet(spreadsheet, SHEETS.documents, DOCUMENT_HEADERS);
  const documents = readObjects(sheet, DOCUMENT_HEADERS).map((row) => normalizeDocumentRecord(row));
  const visibleDocuments = includeDrafts
    ? documents
    : documents.filter((item) => item.status === "published" && item.title && item.fileUrl);

  return sortDocuments(visibleDocuments).map((item) => (includeDrafts ? item : sanitizePublicDocumentRecord(item)));
}

function getPublicDocuments() {
  return getDocuments({
    includeDrafts: false
  });
}

function upsertDocument(item) {
  validateRequired(item, ["title", "fileUrl", "status"]);

  const spreadsheet = getSpreadsheet();
  const sheet =
    spreadsheet.getSheetByName(SHEETS.documents) || ensureSheet(spreadsheet, SHEETS.documents, DOCUMENT_HEADERS);
  const existingItem = item.id ? findRowById(sheet, DOCUMENT_HEADERS, item.id) : null;
  const nextDocument = normalizeDocumentRecord(item || {}, existingItem || {}, {
    strictUrl: true,
    touch: true
  });

  upsertRow(sheet, DOCUMENT_HEADERS, {
    ...nextDocument,
    pinned: toSheetBoolean(nextDocument.pinned)
  });
  invalidatePublicSnapshotCache();
  return nextDocument;
}

function deleteDocument(id) {
  deleteRowById(SHEETS.documents, DOCUMENT_HEADERS, id);
  invalidatePublicSnapshotCache();

  return {
    id,
    deleted: true
  };
}

function normalizeDocumentRecord(item, fallback, options) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const fallbackRecord = fallback && typeof fallback === "object" && !Array.isArray(fallback) ? fallback : {};
  const config = options || {};
  const nowIso = config.touch ? new Date().toISOString() : "";
  const status = validateDocumentStatus(source.status || fallbackRecord.status || "draft");
  const rawFileUrl =
    source.fileUrl !== undefined && source.fileUrl !== null ? source.fileUrl : fallbackRecord.fileUrl || "";
  const fileUrl = config.strictUrl ? normalizePublicMediaUrl(rawFileUrl) : normalizePublicMediaUrlOrEmpty(rawFileUrl);
  const publishedAt = normalizeDocumentPublishedAt({
    source,
    fallback: fallbackRecord,
    status,
    nowIso
  });

  return {
    id: normalizeDocumentString(source.id || fallbackRecord.id || (config.touch ? `document-${Date.now()}` : "")),
    title: normalizeDocumentString(source.title !== undefined ? source.title : fallbackRecord.title),
    description: normalizeDocumentString(
      source.description !== undefined ? source.description : fallbackRecord.description
    ),
    category: normalizeCategoryValue(source.category !== undefined ? source.category : fallbackRecord.category),
    fileUrl,
    fileName: normalizeDocumentString(source.fileName !== undefined ? source.fileName : fallbackRecord.fileName),
    mediaId: normalizeDocumentString(source.mediaId !== undefined ? source.mediaId : fallbackRecord.mediaId),
    publishedAt,
    status,
    order: normalizeDocumentOrder(source.order !== undefined ? source.order : fallbackRecord.order),
    pinned: normalizeSheetBoolean(source.pinned !== undefined ? source.pinned : fallbackRecord.pinned),
    updatedAt: nowIso || normalizeDocumentString(source.updatedAt || fallbackRecord.updatedAt)
  };
}

function normalizeDocumentPublishedAt(input) {
  const sourceValue =
    input.source.publishedAt !== undefined && input.source.publishedAt !== null
      ? input.source.publishedAt
      : input.fallback.publishedAt;
  const normalized = normalizeDocumentString(sourceValue);

  if (normalized) {
    return normalized;
  }

  return input.status === "published" && input.nowIso ? input.nowIso : "";
}

function normalizeDocumentString(value) {
  return String(value || "").trim();
}

function normalizeDocumentOrder(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.floor(numericValue));
}

function validateDocumentStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (ALLOWED_DOCUMENT_STATUSES.indexOf(normalized) === -1) {
    throw createHttpError("Invalid document status.", 400);
  }

  return normalized;
}

function sanitizePublicDocumentRecord(item) {
  return {
    id: item.id || "",
    title: item.title || "",
    description: item.description || "",
    category: item.category || "",
    fileUrl: normalizePublicMediaUrlOrEmpty(item.fileUrl),
    fileName: item.fileName || "",
    mediaId: item.mediaId || "",
    publishedAt: item.publishedAt || "",
    order: normalizeDocumentOrder(item.order),
    pinned: Boolean(item.pinned),
    updatedAt: item.updatedAt || ""
  };
}

function sortDocuments(items) {
  return items.slice().sort(compareDocuments);
}

function compareDocuments(left, right) {
  if (Boolean(left.pinned) !== Boolean(right.pinned)) {
    return left.pinned ? -1 : 1;
  }

  const orderDiff = normalizeDocumentOrder(left.order) - normalizeDocumentOrder(right.order);

  if (orderDiff !== 0) {
    return orderDiff;
  }

  return getDocumentPublishedAtValue(right) - getDocumentPublishedAtValue(left);
}

function getDocumentPublishedAtValue(item) {
  const value = Date.parse(item.publishedAt || "");
  return Number.isFinite(value) ? value : 0;
}
