import type { PublicDocumentItem, PublicDocumentListSnapshot } from "./types";

const snapshotKeys = ["items", "generatedAt"] as const;
const itemKeys = [
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
  "updatedAt"
] as const;
const forbiddenInternalKeys = [
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "sort_order",
  "updated_at",
  "status"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]) {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isIsoString(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function getForbiddenKey(value: Record<string, unknown>) {
  return forbiddenInternalKeys.find((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function assertPublicDocumentItem(value: unknown): asserts value is PublicDocumentItem {
  if (!isRecord(value)) {
    throw new Error("Invalid public-document-list response: each item must be an object");
  }

  const forbiddenKey = getForbiddenKey(value);

  if (forbiddenKey) {
    throw new Error(
      `Invalid public-document-list response: item contains snake_case or internal field "${forbiddenKey}"`
    );
  }

  if (!hasExactKeys(value, itemKeys)) {
    throw new Error(`Invalid public-document-list response: item keys must be ${itemKeys.join(", ")}`);
  }

  for (const key of itemKeys) {
    if (key === "order" || key === "pinned") {
      continue;
    }

    if (typeof value[key] !== "string") {
      throw new Error(`Invalid public-document-list response: item.${key} must be a string`);
    }
  }

  if (typeof value.order !== "number" || !Number.isFinite(value.order)) {
    throw new Error("Invalid public-document-list response: item.order must be a finite number");
  }

  if (typeof value.pinned !== "boolean") {
    throw new Error("Invalid public-document-list response: item.pinned must be a boolean");
  }
}

export function assertPublicDocumentListSnapshot(value: unknown): asserts value is PublicDocumentListSnapshot {
  if (!isRecord(value)) {
    throw new Error("Invalid public-document-list response: snapshot must be an object");
  }

  const forbiddenKey = getForbiddenKey(value);

  if (forbiddenKey) {
    throw new Error(
      `Invalid public-document-list response: snapshot contains snake_case or internal field "${forbiddenKey}"`
    );
  }

  if (!hasExactKeys(value, snapshotKeys)) {
    throw new Error(`Invalid public-document-list response: top-level keys must be ${snapshotKeys.join(", ")}`);
  }

  if (!Array.isArray(value.items)) {
    throw new Error("Invalid public-document-list response: items must be an array");
  }

  if (!isIsoString(value.generatedAt)) {
    throw new Error("Invalid public-document-list response: generatedAt must be an ISO string");
  }

  value.items.forEach(assertPublicDocumentItem);
}

export function isPublicDocumentListSnapshot(value: unknown): value is PublicDocumentListSnapshot {
  try {
    assertPublicDocumentListSnapshot(value);
    return true;
  } catch {
    return false;
  }
}
