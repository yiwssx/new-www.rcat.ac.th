import { describe, expect, it } from "vitest";
import m10ImportDoc from "../../../docs/architecture/m10-public-document-list-redacted-import-transformer-2026-06-11.md?raw";
import fixture from "./fixtures/public-documents.import-source.redacted.json";
import {
  createPublicDocumentListSnapshotFromImportRows,
  sortPublicDocumentD1ImportRows,
  transformPublicDocumentSourceRecord,
  transformPublicDocumentSourceRecords,
  validatePublicDocumentD1ImportRow,
  validatePublicDocumentImportSourceRecord,
  type PublicDocumentImportSourceRecord
} from "../src/import/publicDocumentsImport";
import importModuleSource from "../src/import/publicDocumentsImport.ts?raw";

const records = fixture as PublicDocumentImportSourceRecord[];
const fixtureSource = JSON.stringify(records);
const forbiddenProductionPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);
const forbiddenDriveUrl = `https://${"drive"}.${"google"}.com/file/example`;
const forbiddenScriptUrl = `https://${"script"}.${"google"}.com/macros/s/example`;
const realD1IdPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const publicItemKeys = [
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
].sort();
const forbiddenPublicItemKeys = [
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "sort_order",
  "updated_at",
  "status"
];

describe("M10 redacted public document import fixture", () => {
  it("uses fake source-like public-document-list records only", () => {
    expect(Array.isArray(fixture)).toBe(true);
    expect(fixture.length).toBeGreaterThanOrEqual(5);
    expect(fixtureSource).not.toMatch(forbiddenProductionPattern);
    expect(fixtureSource).not.toMatch(realD1IdPattern);

    const urls = Array.from(fixtureSource.matchAll(/https?:\/\/[^"\s]+/g)).map((match) => match[0]);

    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((url) => {
      expect(new URL(url).hostname).toMatch(/^files\.example\.(test|invalid)$/);
    });
    expect(records.some((record) => record.status === "draft")).toBe(true);
  });
});

describe("M10 public document import transformer", () => {
  it("maps camelCase source records to D1 snake_case rows", () => {
    const row = transformPublicDocumentSourceRecord(records[0]);

    expect(row).toEqual({
      id: records[0].id,
      title: records[0].title,
      description: records[0].description,
      category: records[0].category,
      file_url: records[0].fileUrl,
      file_name: records[0].fileName,
      media_id: records[0].mediaId,
      published_at: records[0].publishedAt,
      sort_order: records[0].order,
      pinned: 1,
      updated_at: records[0].updatedAt,
      status: records[0].status
    });
  });

  it("filters inactive records and creates a PublicDocumentListSnapshot with public camelCase fields only", () => {
    const rows = transformPublicDocumentSourceRecords(records);
    const snapshot = createPublicDocumentListSnapshotFromImportRows(rows, new Date("2026-06-11T00:00:00.000Z"));

    expect(snapshot.generatedAt).toBe("2026-06-11T00:00:00.000Z");
    expect(new Date(snapshot.generatedAt).toISOString()).toBe(snapshot.generatedAt);
    expect(Object.keys(snapshot).sort()).toEqual(["generatedAt", "items"]);
    expect(snapshot.items).toHaveLength(records.filter((record) => record.status === "published").length);
    expect(snapshot.items.some((item) => item.id === "redacted-document-draft-001")).toBe(false);

    snapshot.items.forEach((item) => {
      expect(Object.keys(item).sort()).toEqual(publicItemKeys);
      forbiddenPublicItemKeys.forEach((key) => {
        expect(item).not.toHaveProperty(key);
      });
    });
  });

  it("sorts pinned first, sort_order ascending, published_at descending, then updated_at descending", () => {
    const rows = transformPublicDocumentSourceRecords(records);

    expect(sortPublicDocumentD1ImportRows(rows).map((row) => row.id)).toEqual([
      "redacted-document-pinned-low",
      "redacted-document-pinned-high",
      "redacted-document-standard-low-newer",
      "redacted-document-standard-low-older",
      "redacted-document-standard-high",
      "redacted-document-draft-001"
    ]);

    expect(createPublicDocumentListSnapshotFromImportRows(rows).items.map((item) => item.id)).toEqual([
      "redacted-document-pinned-low",
      "redacted-document-pinned-high",
      "redacted-document-standard-low-newer",
      "redacted-document-standard-low-older",
      "redacted-document-standard-high"
    ]);
  });

  it("returns validation errors for invalid source records and D1 rows", () => {
    expect(
      validatePublicDocumentImportSourceRecord({
        ...records[0],
        id: "",
        title: "",
        fileUrl: forbiddenDriveUrl,
        publishedAt: "not-an-iso-date",
        updatedAt: "not-an-iso-date",
        order: Number.NaN,
        pinned: "yes"
      })
    ).toEqual([
      "id is required",
      "title is required",
      "fileUrl contains a forbidden URL",
      "publishedAt must be a valid ISO string",
      "updatedAt must be a valid ISO string",
      "order must be a finite number",
      "pinned must be boolean-compatible"
    ]);

    expect(
      validatePublicDocumentD1ImportRow({
        ...transformPublicDocumentSourceRecord(records[0]),
        id: "",
        title: "",
        file_url: forbiddenScriptUrl,
        published_at: "not-an-iso-date",
        updated_at: "not-an-iso-date",
        sort_order: Number.NaN,
        pinned: 2
      })
    ).toEqual([
      "id is required",
      "title is required",
      "file_url contains a forbidden URL",
      "published_at must be a valid ISO string",
      "updated_at must be a valid ISO string",
      "sort_order must be a finite number",
      "pinned must be 0 or 1"
    ]);
  });
});

describe("M10 documentation and execution safety", () => {
  it("documents fake-data-only transformer scope without production execution", () => {
    expect(m10ImportDoc).toMatch(
      /Status: redacted transformer and contract validator only\. No production import or cutover is executed\./i
    );
    expect(m10ImportDoc).toMatch(/fake data only/i);
    expect(m10ImportDoc).toMatch(/source camelCase/i);
    expect(m10ImportDoc).toMatch(/D1 snake_case/i);
    expect(m10ImportDoc).toMatch(/public snapshot camelCase/i);
    expect(m10ImportDoc).toMatch(/PublicDocumentListSnapshot/i);
    expect(m10ImportDoc).toMatch(/No-Go Conditions/i);
    expect(m10ImportDoc).toMatch(/Production Safety Confirmation/i);
    expect(m10ImportDoc).not.toMatch(forbiddenProductionPattern);
    expect(m10ImportDoc).not.toMatch(realD1IdPattern);
    expect(m10ImportDoc).not.toMatch(/production (?:import|cutover)\s*(?:completed|approved|enabled|active)/i);
  });

  it("keeps import tooling local-only with no Apps Script imports, network calls, or production write commands", () => {
    expect(importModuleSource).not.toMatch(new RegExp(`AppsScript|googleApi|${"script"}\\.${"google"}\\.com`, "i"));
    expect(importModuleSource).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|wrangler|vercel|d1\s+(?:execute|migrations)/i);
  });
});
