import { expect } from "vitest";
import type { PublicDocumentListSnapshotContract } from "../../src/contracts/publicDocuments";

const PUBLIC_DOCUMENT_LIST_KEYS = ["items", "generatedAt"];
const PUBLIC_DOCUMENT_ITEM_KEYS = [
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
];
const INTERNAL_D1_KEYS = new Set([
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "sort_order",
  "updated_at",
  "status",
  "sampleOnly"
]);
const FORBIDDEN_PRODUCTION_URL_PATTERN = /rcat\.ac\.th|script\.google\.com|drive\.google\.com/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertIsoString(value: unknown) {
  expect(typeof value).toBe("string");
  expect(new Date(String(value)).toISOString()).toBe(value);
}

function visitPayloadKeys(value: unknown, visitor: (key: string) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => visitPayloadKeys(item, visitor));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([key, child]) => {
    visitor(key);
    visitPayloadKeys(child, visitor);
  });
}

export function assertPublicDocumentListSnapshotShape(
  payload: unknown
): asserts payload is PublicDocumentListSnapshotContract {
  expect(isRecord(payload)).toBe(true);

  const snapshot = payload as Record<string, unknown>;
  expect(Object.keys(snapshot)).toEqual(PUBLIC_DOCUMENT_LIST_KEYS);
  expect(Array.isArray(snapshot.items)).toBe(true);
  assertIsoString(snapshot.generatedAt);

  (snapshot.items as unknown[]).forEach((item) => {
    expect(isRecord(item)).toBe(true);
    expect(Object.keys(item as Record<string, unknown>)).toEqual(PUBLIC_DOCUMENT_ITEM_KEYS);

    const document = item as Record<string, unknown>;
    expect(typeof document.id).toBe("string");
    expect(typeof document.title).toBe("string");
    expect(typeof document.description).toBe("string");
    expect(typeof document.category).toBe("string");
    expect(typeof document.fileUrl).toBe("string");
    expect(typeof document.fileName).toBe("string");
    expect(typeof document.mediaId).toBe("string");
    expect(typeof document.publishedAt).toBe("string");
    expect(typeof document.order).toBe("number");
    expect(Number.isFinite(document.order)).toBe(true);
    expect(typeof document.pinned).toBe("boolean");
    expect(typeof document.updatedAt).toBe("string");
  });
}

export function assertPublicDocumentListParity(actual: unknown, expected: unknown) {
  assertPublicDocumentListSnapshotShape(actual);
  assertPublicDocumentListSnapshotShape(expected);
  assertNoInternalD1Fields(actual);
  assertNoInternalD1Fields(expected);
  assertNoForbiddenProductionUrls(actual);
  assertNoForbiddenProductionUrls(expected);
  expect(actual).toEqual(expected);
}

export function assertNoInternalD1Fields(payload: unknown) {
  visitPayloadKeys(payload, (key) => {
    expect(INTERNAL_D1_KEYS.has(key), `internal field leaked: ${key}`).toBe(false);
  });
}

export function assertNoForbiddenProductionUrls(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(FORBIDDEN_PRODUCTION_URL_PATTERN);
}
