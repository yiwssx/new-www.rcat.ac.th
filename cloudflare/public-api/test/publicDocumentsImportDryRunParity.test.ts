import { describe, expect, it } from "vitest";
import m11Doc from "../../../docs/architecture/m11-public-document-list-local-import-dry-run-2026-06-11.md?raw";
import publicApiProviderSource from "../../../src/config/publicApiProvider.ts?raw";
import fixture from "./fixtures/public-documents.import-source.redacted.json";
import {
  createPublicDocumentListSnapshotFromImportRows,
  transformPublicDocumentSourceRecords,
  validatePublicDocumentD1ImportRow,
  validatePublicDocumentImportSourceRecord,
  type PublicDocumentD1ImportRow,
  type PublicDocumentImportSourceRecord
} from "../src/import/publicDocumentsImport";
import {
  formatPublicDocumentsImportDryRunResult,
  runPublicDocumentsImportDryRun,
  validatePublicDocumentD1ImportRow as validateCliPublicDocumentD1ImportRow
} from "../scripts/public-documents-import-dry-run.mjs";
import cliSource from "../scripts/public-documents-import-dry-run.mjs?raw";
import wranglerToml from "../wrangler.toml?raw";

const records = fixture as PublicDocumentImportSourceRecord[];
const fixedGeneratedAt = new Date("2026-06-11T00:00:00.000Z");
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
  "status",
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "sort_order",
  "updated_at"
];
const forbiddenProductionPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);
const realD1IdPattern = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const d1IdLookingValue = ["123e4567", "e89b", "12d3", "a456", "426614174000"].join("-");
const forbiddenDriveUrl = `https://${"drive"}.${"google"}.com/file/example`;
const expectedIds = [
  "redacted-document-pinned-low",
  "redacted-document-pinned-high",
  "redacted-document-standard-low-newer",
  "redacted-document-standard-low-older",
  "redacted-document-standard-high"
];

async function runCliWithRecords(inputRecords: unknown[], generatedAt = fixedGeneratedAt) {
  return runPublicDocumentsImportDryRun(["--input", "redacted-parity.json"], {
    generatedAt,
    readFile: async () => JSON.stringify(inputRecords)
  });
}

function canonicalSnapshot() {
  const rows = transformPublicDocumentSourceRecords(records);
  const snapshot = createPublicDocumentListSnapshotFromImportRows(rows, fixedGeneratedAt);

  return { rows, snapshot };
}

function expectPublicSnapshotContract(snapshot: { items: object[]; generatedAt: string | null }) {
  expect(Object.keys(snapshot).sort()).toEqual(["generatedAt", "items"]);
  snapshot.items.forEach((item) => {
    expect(Object.keys(item).sort()).toEqual(publicItemKeys);
    forbiddenPublicItemKeys.forEach((key) => {
      expect(item).not.toHaveProperty(key);
    });
  });
}

describe("M11.1 public document import dry-run parity guard", () => {
  it("matches canonical snapshot ids, counts, first ids, generatedAt, and ordering", async () => {
    const { rows, snapshot } = canonicalSnapshot();
    const cliResult = await runCliWithRecords(records);

    expect(cliResult.status).toBe("READY");
    expect(cliResult.snapshot.generatedAt).toBe(snapshot.generatedAt);
    expect(cliResult.snapshot.items.map((item) => item.id)).toEqual(snapshot.items.map((item) => item.id));
    expect(cliResult.snapshot.items.map((item) => item.id)).toEqual(expectedIds);
    expect(cliResult.summary.sourceRecordCount).toBe(records.length);
    expect(cliResult.summary.sourceRecordCount).toBe(rows.length);
    expect(cliResult.summary.transformedRowCount).toBe(rows.length);
    expect(cliResult.summary.publicItemCount).toBe(snapshot.items.length);
    expect(cliResult.summary.excludedDraftInactiveCount).toBe(rows.filter((row) => row.status !== "published").length);
    expect(cliResult.summary.firstPublicItemIds).toEqual(snapshot.items.slice(0, 3).map((item) => item.id));
  });

  it("matches canonical public snapshot contract without snake_case or internal leakage", async () => {
    const { snapshot } = canonicalSnapshot();
    const cliResult = await runCliWithRecords(records);

    expectPublicSnapshotContract(snapshot);
    expectPublicSnapshotContract(cliResult.snapshot);
  });

  it("agrees with canonical source validation and reports record indexes safely", async () => {
    const cases: Array<[string, Partial<PublicDocumentImportSourceRecord>, string]> = [
      ["invalid status", { status: "archived" as "published" }, "status must be one of: published, draft, inactive"],
      [
        "unknown source field",
        { extraField: "blocked" } as Partial<PublicDocumentImportSourceRecord>,
        "unknown source field: extraField"
      ],
      ["unsafe file URL", { fileUrl: forbiddenDriveUrl }, "fileUrl contains a forbidden URL"],
      ["unsafe fileName", { fileName: "../blocked.exe" }, "fileName must not contain path traversal"],
      ["unsafe mediaId", { mediaId: d1IdLookingValue }, "mediaId must not contain a D1 id pattern"],
      ["invalid ISO date", { publishedAt: "2026-06-11T00:00:00Z" }, "publishedAt must be a valid ISO string"],
      ["invalid pinned", { pinned: "true" as unknown as boolean }, "pinned must be boolean-compatible"],
      ["invalid order", { order: 1.5 }, "order must be a non-negative integer"]
    ];

    for (const [label, patch, expectedMessage] of cases) {
      const invalidRecord = { ...records[0], ...patch };
      const canonicalErrors = validatePublicDocumentImportSourceRecord(invalidRecord);
      const cliResult = await runCliWithRecords([records[0], invalidRecord]);
      const cliOutput = formatPublicDocumentsImportDryRunResult(cliResult);

      expect(canonicalErrors, label).toContain(expectedMessage);
      expect(cliResult.status, label).toBe("BLOCKED");
      expect(cliResult.validationIssues, label).toContainEqual({ index: 1, messages: canonicalErrors });
      expect(cliOutput, label).toContain("record[1]");
      expect(cliOutput, label).toContain(expectedMessage);
      expect(cliOutput, label).not.toContain(records[0].title);
      expect(cliOutput, label).not.toContain(records[0].fileUrl);
    }
  });

  it("agrees with canonical D1 row validation and blocks snapshot creation before public output", () => {
    const row = transformPublicDocumentSourceRecords(records)[0];
    const cases: Array<[string, Partial<PublicDocumentD1ImportRow>, string]> = [
      ["unsafe file_name", { file_name: "../blocked.exe" }, "file_name must not contain path traversal"],
      ["invalid status", { status: "live" as "published" }, "status must be one of: published, draft, inactive"],
      [
        "unknown D1 row field",
        { internal_note: "blocked" } as Partial<PublicDocumentD1ImportRow>,
        "unknown D1 row field: internal_note"
      ],
      ["invalid sort_order", { sort_order: -1 }, "sort_order must be a non-negative integer"],
      ["invalid pinned", { pinned: 2 as 0 }, "pinned must be 0 or 1"]
    ];

    cases.forEach(([label, patch, expectedMessage]) => {
      const invalidRow = { ...row, ...patch };
      const canonicalErrors = validatePublicDocumentD1ImportRow(invalidRow);
      const cliErrors = validateCliPublicDocumentD1ImportRow(invalidRow);

      expect(canonicalErrors, label).toContain(expectedMessage);
      expect(cliErrors, label).toEqual(canonicalErrors);
      expect(() => createPublicDocumentListSnapshotFromImportRows([invalidRow], fixedGeneratedAt)).toThrow(
        expectedMessage
      );
    });
  });

  it("keeps safe summary and JSON output free of full records, file URLs, production URLs, and D1 ids", async () => {
    const cliResult = await runCliWithRecords(records);
    const textOutput = formatPublicDocumentsImportDryRunResult(cliResult);
    const jsonOutput = formatPublicDocumentsImportDryRunResult(cliResult, { json: true });
    const fixtureText = JSON.stringify(records);

    expect(fixtureText).not.toMatch(forbiddenProductionPattern);
    expect(fixtureText).not.toMatch(realD1IdPattern);
    [textOutput, jsonOutput].forEach((output) => {
      expect(output).not.toMatch(forbiddenProductionPattern);
      expect(output).not.toMatch(realD1IdPattern);
      expect(output).not.toMatch(/https:\/\/files\.example\.(?:test|invalid)/);
      expect(output).not.toContain(records[0].title);
      expect(output).not.toContain(records[0].description);
    });
  });

  it("keeps CLI local-only and committed config/frontend defaults safe", () => {
    expect(cliSource).not.toMatch(/\bfetch\s*\(/);
    expect(cliSource).not.toMatch(/\bXMLHttpRequest\b/);
    expect(cliSource).not.toMatch(/\bwrangler\b/i);
    expect(cliSource).not.toMatch(/\bvercel\b/i);
    expect(cliSource).not.toMatch(/\bcurl\b/i);
    expect(cliSource).not.toMatch(/\bchild_process\b/);
    expect(cliSource).not.toMatch(/\bexec(?:File|Sync)?\s*\(/);
    expect(cliSource).not.toMatch(/\bspawn(?:Sync)?\s*\(/);
    expect(cliSource).not.toMatch(/\bd1\s+(?:execute|migrations)\b/i);
    expect(cliSource).not.toMatch(/AppsScript|googleApi/i);
    expect(wranglerToml).toContain('database_id = "local-placeholder"');
    expect(wranglerToml).toContain('database_id = "preview-placeholder"');
    expect(publicApiProviderSource).toContain('return provider === "cloudflare" ? "cloudflare" : "apps-script"');
  });

  it("documents the M11.1 dry-run parity guard", () => {
    expect(m11Doc).toMatch(/## M11\.1 Dry-Run Parity Guard/);
    expect(m11Doc).toMatch(/canonical module remains source/i);
    expect(m11Doc).toMatch(/parity tests compare CLI output/i);
    expect(m11Doc).toMatch(/sorting/i);
    expect(m11Doc).toMatch(/invalid source record behavior/i);
    expect(m11Doc).toMatch(/invalid D1 row behavior/i);
    expect(m11Doc).toMatch(/no D1 writes/i);
    expect(m11Doc).toMatch(/no network calls/i);
    expect(m11Doc).not.toMatch(forbiddenProductionPattern);
    expect(m11Doc).not.toMatch(realD1IdPattern);
  });
});
