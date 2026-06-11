import { describe, expect, it } from "vitest";
import m11Doc from "../../../docs/architecture/m11-public-document-list-local-import-dry-run-2026-06-11.md?raw";
import rootPackageJsonSource from "../../../package.json?raw";
import workerPackageJsonSource from "../package.json?raw";
import scriptSource from "../scripts/public-documents-import-dry-run.mjs?raw";
import {
  formatPublicDocumentsImportDryRunResult,
  runPublicDocumentsImportDryRun
} from "../scripts/public-documents-import-dry-run.mjs";

const forbiddenProductionPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);
const realD1IdPattern = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const d1IdLookingValue = ["123e4567", "e89b", "12d3", "a456", "426614174000"].join("-");
const forbiddenDriveUrl = `https://${"drive"}.${"google"}.com/file/example`;
const forbiddenScriptUrl = `https://${"script"}.${"google"}.com/macros/s/example`;
const forbiddenSchoolUrl = `https://www.${"rcat"}.ac.th/private/example.pdf`;
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

const validRecord = {
  id: "redacted-document-test-001",
  title: "Redacted local dry-run document",
  description: "Fake dry-run document only.",
  category: "redacted-test",
  fileUrl: "https://files.example.test/public-documents/redacted-test.pdf",
  fileName: "redacted-test.pdf",
  mediaId: "redacted-media-test-001",
  publishedAt: "2026-06-11T08:00:00.000Z",
  order: 10,
  pinned: false,
  updatedAt: "2026-06-11T09:00:00.000Z",
  status: "published"
};

async function runWithRecords(records: unknown[]) {
  return runPublicDocumentsImportDryRun(["--input", "redacted-fixture.json"], {
    cwd: "C:/repo",
    readFile: async () => JSON.stringify(records)
  });
}

describe("M11 public document import dry-run CLI", () => {
  it("script exists and is exposed through package scripts", () => {
    const rootPackageJson = JSON.parse(rootPackageJsonSource);
    const workerPackageJson = JSON.parse(workerPackageJsonSource);

    expect(scriptSource).toContain("runPublicDocumentsImportDryRun");
    expect(rootPackageJson.scripts["worker:public-documents:import:dry-run"]).toBe(
      "node cloudflare/public-api/scripts/public-documents-import-dry-run.mjs"
    );
    expect(workerPackageJson.scripts["public-documents:import:dry-run"]).toBe(
      "node scripts/public-documents-import-dry-run.mjs"
    );
  });

  it("default dry-run uses the redacted fixture and returns READY with safe summary text", async () => {
    const result = await runPublicDocumentsImportDryRun([]);
    const output = formatPublicDocumentsImportDryRunResult(result);

    expect(result.status).toBe("READY");
    expect(result.summary.inputPath).toBe(
      "cloudflare/public-api/test/fixtures/public-documents.import-source.redacted.json"
    );
    expect(result.summary.sourceRecordCount).toBe(6);
    expect(result.summary.transformedRowCount).toBe(6);
    expect(result.summary.publicItemCount).toBe(5);
    expect(result.summary.excludedDraftInactiveCount).toBe(1);
    expect(result.summary.validationErrorCount).toBe(0);
    expect(result.summary.firstPublicItemIds).toEqual([
      "redacted-document-pinned-low",
      "redacted-document-pinned-high",
      "redacted-document-standard-low-newer"
    ]);
    const generatedAt = result.summary.generatedAt;

    if (generatedAt === null) {
      throw new Error("generatedAt must be present for READY dry-run");
    }

    expect(new Date(generatedAt).toISOString()).toBe(generatedAt);
    expect(output).toContain("READY");
    expect(output).toContain("Source record count: 6");
    expect(output).toContain("Transformed row count: 6");
    expect(output).toContain("Public item count: 5");
    expect(output).toContain("Excluded draft/inactive count: 1");
    expect(output).toContain("First 3 public item IDs:");
    expect(output).toContain("No D1 writes were run.");
    expect(output).toContain("No production commands were run.");
    expect(output).toContain("No network calls were made.");
    expect(output).not.toMatch(/https:\/\/files\.example\.(?:test|invalid)/);
  });

  it("--json prints a JSON summary only without full records or file URLs", async () => {
    const result = await runPublicDocumentsImportDryRun(["--json"]);
    const output = formatPublicDocumentsImportDryRunResult(result, { json: true });
    const parsed = JSON.parse(output);

    expect(parsed.status).toBe("READY");
    expect(parsed.summary.sourceRecordCount).toBe(6);
    expect(parsed.summary.firstPublicItemIds).toHaveLength(3);
    expect(output).not.toContain("fileUrl");
    expect(output).not.toMatch(/https:\/\/files\.example\.(?:test|invalid)/);
    expect(output).not.toContain("Redacted pinned low order document");
  });

  it("returns BLOCKED for malformed JSON and non-array JSON safely", async () => {
    const malformed = await runPublicDocumentsImportDryRun(["--input", "bad.json"], {
      cwd: "C:/repo",
      readFile: async () => "{not-json"
    });
    const nonArray = await runPublicDocumentsImportDryRun(["--input", "bad.json"], {
      cwd: "C:/repo",
      readFile: async () => JSON.stringify({ records: [] })
    });

    expect(malformed.status).toBe("BLOCKED");
    expect(malformed.validationIssues).toContainEqual({ index: null, messages: ["input must be valid JSON"] });
    expect(nonArray.status).toBe("BLOCKED");
    expect(nonArray.validationIssues).toContainEqual({ index: null, messages: ["input JSON must be an array"] });
  });

  it("returns BLOCKED for invalid records without printing full record contents", async () => {
    const result = await runWithRecords([
      validRecord,
      {
        ...validRecord,
        id: "redacted-invalid-record",
        title: "",
        fileUrl: "https://files.example.test/public-documents/should-not-print.pdf"
      }
    ]);
    const output = formatPublicDocumentsImportDryRunResult(result);

    expect(result.status).toBe("BLOCKED");
    expect(result.validationIssues).toContainEqual({ index: 1, messages: ["title is required"] });
    expect(output).toContain("record[1]");
    expect(output).toContain("title is required");
    expect(output).not.toContain("should-not-print.pdf");
    expect(output).not.toContain("Redacted local dry-run document");
  });

  it("rejects forbidden URLs, D1-looking ids, unknown fields, unsafe fileName, and unsafe mediaId", async () => {
    const result = await runWithRecords([
      { ...validRecord, fileUrl: forbiddenScriptUrl },
      { ...validRecord, fileUrl: forbiddenDriveUrl },
      { ...validRecord, fileUrl: forbiddenSchoolUrl },
      { ...validRecord, mediaId: d1IdLookingValue },
      { ...validRecord, extraField: "blocked" },
      { ...validRecord, fileName: "../blocked.exe" },
      { ...validRecord, mediaId: "https://files.example.test/media/blocked" }
    ]);
    const output = formatPublicDocumentsImportDryRunResult(result);

    expect(result.status).toBe("BLOCKED");
    expect(output).toContain("fileUrl contains a forbidden URL");
    expect(output).toContain("mediaId must not contain a D1 id pattern");
    expect(output).toContain("unknown source field: extraField");
    expect(output).toContain("fileName must not contain path traversal");
    expect(output).toContain("mediaId must not be URL-like");
    expect(output).not.toMatch(forbiddenProductionPattern);
    expect(output).not.toMatch(realD1IdPattern);
  });

  it("validates public snapshot fields and ordering", async () => {
    const result = await runPublicDocumentsImportDryRun([]);

    expect(result.status).toBe("READY");
    expect(Object.keys(result.snapshot).sort()).toEqual(["generatedAt", "items"]);
    result.snapshot.items.forEach((item: Record<string, unknown>) => {
      expect(Object.keys(item).sort()).toEqual(publicItemKeys);
      forbiddenPublicItemKeys.forEach((key) => {
        expect(item).not.toHaveProperty(key);
      });
    });
    expect(result.snapshot.items.map((item) => item.id)).toEqual([
      "redacted-document-pinned-low",
      "redacted-document-pinned-high",
      "redacted-document-standard-low-newer",
      "redacted-document-standard-low-older",
      "redacted-document-standard-high"
    ]);
  });

  it("documents the local-only dry-run scope", () => {
    expect(m11Doc).toMatch(
      /Status: local import dry-run only\. No D1 writes, production import, deployment, or cutover is executed\./i
    );
    expect(m11Doc).toContain("pnpm worker:public-documents:import:dry-run");
    expect(m11Doc).toMatch(/summary only/i);
    expect(m11Doc).toMatch(/No-Go Conditions/i);
    expect(m11Doc).not.toMatch(forbiddenProductionPattern);
    expect(m11Doc).not.toMatch(realD1IdPattern);
  });

  it("contains no network, remote execution, Apps Script, or production command primitives", () => {
    expect(scriptSource).not.toMatch(/\bfetch\s*\(/);
    expect(scriptSource).not.toMatch(/\bXMLHttpRequest\b/);
    expect(scriptSource).not.toMatch(/\bwrangler\b/i);
    expect(scriptSource).not.toMatch(/\bvercel\b/i);
    expect(scriptSource).not.toMatch(/\bcurl\b/i);
    expect(scriptSource).not.toMatch(/\bchild_process\b/);
    expect(scriptSource).not.toMatch(/\bexec(?:File|Sync)?\s*\(/);
    expect(scriptSource).not.toMatch(/\bspawn(?:Sync)?\s*\(/);
    expect(scriptSource).not.toMatch(/\bd1\s+(?:execute|migrations)\b/i);
    expect(scriptSource).not.toMatch(/AppsScript|googleApi/i);
    expect(scriptSource).not.toMatch(forbiddenProductionPattern);
    expect(scriptSource).not.toMatch(realD1IdPattern);
  });
});
