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

export type PublicDocumentD1ImportRow = DocumentRow;
type ImportValidationRecord = Record<string, unknown>;
type D1ImportValidationRecord = Record<string, unknown>;

const ACTIVE_IMPORT_STATUS: PublicDocumentImportStatus = "published";
const FORBIDDEN_HOST_PARTS = [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`];
const D1_ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoString(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasForbiddenUrl(value: string) {
  const normalizedValue = value.toLowerCase();

  return FORBIDDEN_HOST_PARTS.some((hostPart) => normalizedValue.includes(hostPart));
}

function hasD1IdPattern(value: string) {
  return D1_ID_PATTERN.test(value);
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

export function validatePublicDocumentImportSourceRecord(record: ImportValidationRecord): string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(record.id)) {
    errors.push("id is required");
  } else if (typeof record.id === "string" && hasD1IdPattern(record.id)) {
    errors.push("id must not contain a D1 id pattern");
  }

  if (!isNonEmptyString(record.title)) {
    errors.push("title is required");
  }

  if (typeof record.fileUrl === "string" && hasForbiddenUrl(record.fileUrl)) {
    errors.push("fileUrl contains a forbidden URL");
  }

  if (!isIsoString(record.publishedAt)) {
    errors.push("publishedAt must be a valid ISO string");
  }

  if (!isIsoString(record.updatedAt)) {
    errors.push("updatedAt must be a valid ISO string");
  }

  if (!isFiniteNumber(record.order)) {
    errors.push("order must be a finite number");
  }

  if (!isSourcePinnedCompatible(record.pinned)) {
    errors.push("pinned must be boolean-compatible");
  }

  return errors;
}

export function validatePublicDocumentD1ImportRow(row: D1ImportValidationRecord): string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(row.id)) {
    errors.push("id is required");
  } else if (typeof row.id === "string" && hasD1IdPattern(row.id)) {
    errors.push("id must not contain a D1 id pattern");
  }

  if (!isNonEmptyString(row.title)) {
    errors.push("title is required");
  }

  if (typeof row.file_url === "string" && hasForbiddenUrl(row.file_url)) {
    errors.push("file_url contains a forbidden URL");
  }

  if (!isIsoString(row.published_at)) {
    errors.push("published_at must be a valid ISO string");
  }

  if (!isIsoString(row.updated_at)) {
    errors.push("updated_at must be a valid ISO string");
  }

  if (!isFiniteNumber(row.sort_order)) {
    errors.push("sort_order must be a finite number");
  }

  if (row.pinned !== 0 && row.pinned !== 1) {
    errors.push("pinned must be 0 or 1");
  }

  return errors;
}

export function transformPublicDocumentSourceRecord(
  record: PublicDocumentImportSourceRecord
): PublicDocumentD1ImportRow {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    category: record.category,
    file_url: record.fileUrl,
    file_name: record.fileName,
    media_id: record.mediaId,
    published_at: record.publishedAt,
    status: record.status === "published" ? "published" : "draft",
    sort_order: record.order,
    pinned: normalizePinned(record.pinned),
    updated_at: record.updatedAt
  };
}

export function transformPublicDocumentSourceRecords(
  records: PublicDocumentImportSourceRecord[]
): PublicDocumentD1ImportRow[] {
  return records.map(transformPublicDocumentSourceRecord);
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
  return createPublicDocumentListSnapshot(
    sortPublicDocumentD1ImportRows(rows).filter((row) => row.status === ACTIVE_IMPORT_STATUS),
    generatedAt
  );
}
