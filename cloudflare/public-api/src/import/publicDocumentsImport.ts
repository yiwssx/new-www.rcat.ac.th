import { createPublicDocumentListSnapshot } from "../adapters/publicDocumentsAdapter";
import type { PublicDocumentListSnapshotContract } from "../contracts/publicDocuments";
import type { DocumentRow } from "../db/schema";

export type PublicDocumentImportStatus = "draft" | "published" | "inactive";

export interface PublicDocumentImportSourceRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName: string;
  mediaId: string;
  publishedAt: string;
  order: number;
  pinned: boolean | 0 | 1;
  updatedAt: string;
  status: PublicDocumentImportStatus;
}

export type PublicDocumentD1ImportRow = Omit<DocumentRow, "status"> & {
  status: PublicDocumentImportStatus;
};
type ImportValidationRecord = Record<string, unknown>;
type D1ImportValidationRecord = Record<string, unknown>;

const ACTIVE_IMPORT_STATUS: PublicDocumentImportStatus = "published";
const ALLOWED_IMPORT_STATUSES = [
  "published",
  "draft",
  "inactive"
] as const satisfies readonly PublicDocumentImportStatus[];
const ALLOWED_STATUS_MESSAGE = "status must be one of: published, draft, inactive";
const FORBIDDEN_HOST_PARTS = [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`];
const D1_ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const TOKEN_LIKE_QUERY_KEYS = new Set(["token", "key", "secret", "signature", "sig", "auth"]);
const SAFE_DOCUMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"]);
const SOURCE_RECORD_FIELDS = new Set([
  "id",
  "title",
  "description",
  "category",
  "fileUrl",
  "fileName",
  "mediaId",
  "publishedAt",
  "order",
  "pinned",
  "updatedAt",
  "status"
]);
const D1_ROW_FIELDS = new Set([
  "id",
  "title",
  "description",
  "category",
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "sort_order",
  "pinned",
  "updated_at",
  "status"
]);
const SOURCE_REQUIRED_STRING_FIELDS = [
  "id",
  "title",
  "description",
  "category",
  "fileUrl",
  "fileName",
  "mediaId",
  "publishedAt",
  "updatedAt",
  "status"
];
const D1_REQUIRED_STRING_FIELDS = [
  "id",
  "title",
  "description",
  "category",
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "updated_at",
  "status"
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoString(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function hasForbiddenUrl(value: string) {
  const normalizedValue = value.toLowerCase();

  return FORBIDDEN_HOST_PARTS.some((hostPart) => normalizedValue.includes(hostPart));
}

function hasD1IdPattern(value: string) {
  return D1_ID_PATTERN.test(value);
}

function isAllowedStatus(value: unknown): value is PublicDocumentImportStatus {
  return typeof value === "string" && ALLOWED_IMPORT_STATUSES.includes(value as PublicDocumentImportStatus);
}

function isSourcePinnedCompatible(value: unknown) {
  return typeof value === "boolean" || value === 0 || value === 1;
}

function normalizePinned(value: boolean | 0 | 1): 0 | 1 {
  return value === true || value === 1 ? 1 : 0;
}

function toTimestamp(value: string) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function validateUnknownFields(record: ImportValidationRecord, allowedFields: Set<string>, label: string) {
  return Object.keys(record)
    .filter((field) => !allowedFields.has(field))
    .map((field) => `unknown ${label} field: ${field}`);
}

function validateRequiredStrings(record: ImportValidationRecord, fields: string[]) {
  return fields.flatMap((field) => (isNonEmptyString(record[field]) ? [] : [`${field} is required`]));
}

function validateStrictIsoField(record: ImportValidationRecord, field: string) {
  if (!isNonEmptyString(record[field])) {
    return [];
  }

  return isIsoString(record[field]) ? [] : [`${field} must be a valid ISO string`];
}

function validateStatus(record: ImportValidationRecord) {
  return isAllowedStatus(record.status) ? [] : [ALLOWED_STATUS_MESSAGE];
}

function validateFileUrlField(record: ImportValidationRecord, field: string) {
  const value = record[field];

  if (!isNonEmptyString(value)) {
    return [];
  }

  const errors: string[] = [];

  if (hasForbiddenUrl(value)) {
    errors.push(`${field} contains a forbidden URL`);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    errors.push(`${field} must be a valid HTTPS URL`);
    return errors;
  }

  if (url.protocol !== "https:") {
    errors.push(`${field} must be a valid HTTPS URL`);
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost")) {
    errors.push(`${field} must not use localhost`);
  }

  const hasTokenLikeQuery = Array.from(url.searchParams.keys()).some((key) =>
    TOKEN_LIKE_QUERY_KEYS.has(key.toLowerCase())
  );

  if (hasTokenLikeQuery) {
    errors.push(`${field} must not contain token-like query parameters`);
  }

  return errors;
}

function validateFileNameField(record: ImportValidationRecord, field: string) {
  const value = record[field];

  if (!isNonEmptyString(value)) {
    return [];
  }

  const fileName = value.trim();
  const errors: string[] = [];

  if (fileName.includes("..")) {
    errors.push(`${field} must not contain path traversal`);
  }

  if (fileName.includes("/") || fileName.includes("\\")) {
    errors.push(`${field} must not contain path separators`);
  }

  if (fileName.includes("?")) {
    errors.push(`${field} must not contain query strings`);
  }

  const extensionStart = fileName.lastIndexOf(".");
  const extension = extensionStart >= 0 ? fileName.slice(extensionStart).toLowerCase() : "";

  if (!SAFE_DOCUMENT_EXTENSIONS.has(extension)) {
    errors.push(`${field} must use a safe document extension`);
  }

  return errors;
}

function isUrlLike(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function validateMediaIdField(record: ImportValidationRecord, field: string) {
  const value = record[field];

  if (!isNonEmptyString(value)) {
    return [];
  }

  const mediaId = value.trim();
  const errors: string[] = [];

  if (isUrlLike(mediaId)) {
    errors.push(`${field} must not be URL-like`);
  }

  if (hasForbiddenUrl(mediaId)) {
    errors.push(`${field} contains a forbidden URL`);
  }

  if (hasD1IdPattern(mediaId)) {
    errors.push(`${field} must not contain a D1 id pattern`);
  }

  return errors;
}

function validateImportRowForSnapshot(row: PublicDocumentD1ImportRow, index: number) {
  const errors = validatePublicDocumentD1ImportRow(row);

  if (errors.length > 0) {
    throw new Error(`row[${index}] invalid: ${errors.join("; ")}`);
  }
}

function isPublishedDocumentRow(row: PublicDocumentD1ImportRow): row is DocumentRow & { status: "published" } {
  return row.status === ACTIVE_IMPORT_STATUS;
}

export function validatePublicDocumentImportSourceRecord(record: ImportValidationRecord): string[] {
  const errors: string[] = [];

  errors.push(...validateUnknownFields(record, SOURCE_RECORD_FIELDS, "source"));
  errors.push(...validateRequiredStrings(record, SOURCE_REQUIRED_STRING_FIELDS));

  if (!isNonEmptyString(record.id)) {
    // Required string validation above owns this error.
  } else if (typeof record.id === "string" && hasD1IdPattern(record.id)) {
    errors.push("id must not contain a D1 id pattern");
  }

  errors.push(...validateStatus(record));
  errors.push(...validateFileUrlField(record, "fileUrl"));
  errors.push(...validateFileNameField(record, "fileName"));
  errors.push(...validateMediaIdField(record, "mediaId"));
  errors.push(...validateStrictIsoField(record, "publishedAt"));
  errors.push(...validateStrictIsoField(record, "updatedAt"));

  if (!isNonNegativeInteger(record.order)) {
    errors.push("order must be a non-negative integer");
  }

  if (!isSourcePinnedCompatible(record.pinned)) {
    errors.push("pinned must be boolean-compatible");
  }

  return errors;
}

export function validatePublicDocumentD1ImportRow(row: D1ImportValidationRecord): string[] {
  const errors: string[] = [];

  errors.push(...validateUnknownFields(row, D1_ROW_FIELDS, "D1 row"));
  errors.push(...validateRequiredStrings(row, D1_REQUIRED_STRING_FIELDS));

  if (!isNonEmptyString(row.id)) {
    // Required string validation above owns this error.
  } else if (typeof row.id === "string" && hasD1IdPattern(row.id)) {
    errors.push("id must not contain a D1 id pattern");
  }

  errors.push(...validateStatus(row));
  errors.push(...validateFileUrlField(row, "file_url"));
  errors.push(...validateFileNameField(row, "file_name"));
  errors.push(...validateMediaIdField(row, "media_id"));
  errors.push(...validateStrictIsoField(row, "published_at"));
  errors.push(...validateStrictIsoField(row, "updated_at"));

  if (!isNonNegativeInteger(row.sort_order)) {
    errors.push("sort_order must be a non-negative integer");
  }

  if (row.pinned !== 0 && row.pinned !== 1) {
    errors.push("pinned must be 0 or 1");
  }

  return errors;
}

export function transformPublicDocumentSourceRecord(
  record: PublicDocumentImportSourceRecord
): PublicDocumentD1ImportRow {
  const errors = validatePublicDocumentImportSourceRecord({ ...record });

  if (errors.length > 0) {
    throw new Error(`public document source record invalid: ${errors.join("; ")}`);
  }

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    category: record.category,
    file_url: record.fileUrl,
    file_name: record.fileName,
    media_id: record.mediaId,
    published_at: record.publishedAt,
    status: record.status,
    sort_order: record.order,
    pinned: normalizePinned(record.pinned),
    updated_at: record.updatedAt
  };
}

export function transformPublicDocumentSourceRecords(
  records: PublicDocumentImportSourceRecord[]
): PublicDocumentD1ImportRow[] {
  return records.map((record, index) => {
    const errors = validatePublicDocumentImportSourceRecord({ ...record });

    if (errors.length > 0) {
      throw new Error(`record[${index}] invalid: ${errors.join("; ")}`);
    }

    return transformPublicDocumentSourceRecord(record);
  });
}

export function sortPublicDocumentD1ImportRows(rows: PublicDocumentD1ImportRow[]): PublicDocumentD1ImportRow[] {
  return [...rows].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return right.pinned - left.pinned;
    }

    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    const publishedDelta = toTimestamp(right.published_at) - toTimestamp(left.published_at);

    if (publishedDelta !== 0) {
      return publishedDelta;
    }

    return toTimestamp(right.updated_at) - toTimestamp(left.updated_at);
  });
}

export function createPublicDocumentListSnapshotFromImportRows(
  rows: PublicDocumentD1ImportRow[],
  generatedAt = new Date()
): PublicDocumentListSnapshotContract {
  rows.forEach(validateImportRowForSnapshot);

  return createPublicDocumentListSnapshot(
    sortPublicDocumentD1ImportRows(rows).filter(isPublishedDocumentRow),
    generatedAt
  );
}
