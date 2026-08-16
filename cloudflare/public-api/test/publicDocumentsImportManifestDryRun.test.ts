import { describe, expect, it } from "vitest";
import m12Doc from "../../../docs/architecture/m12-public-document-list-import-artifact-manifest-dry-run-2026-06-11.md?raw";
import rootPackageJsonSource from "../../../package.json?raw";
import publicApiProviderSource from "../../../src/config/publicApiProvider.ts?raw";
import rawFixture from "./fixtures/public-documents.import-source.redacted.json?raw";
import {
  formatPublicDocumentsImportManifestDryRunResult,
  runPublicDocumentsImportManifestDryRun
} from "../scripts/public-documents-import-manifest-dry-run.mjs";
import manifestScriptSource from "../scripts/public-documents-import-manifest-dry-run.mjs?raw";
import workerPackageJsonSource from "../package.json?raw";
import wranglerToml from "../wrangler.toml?raw";

const defaultInputPath = "cloudflare/public-api/test/fixtures/public-documents.import-source.redacted.json";
const fixedGeneratedAt = "2026-06-11T00:00:00.000Z";
const forbiddenProductionPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);
const realD1IdPattern = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const d1IdLookingValue = ["123e4567", "e89b", "12d3", "a456", "426614174000"].join("-");
const forbiddenDriveUrl = `https://${"drive"}.${"google"}.com/file/example`;
const fullFileUrlPattern = /https:\/\/files\.example\.(?:test|invalid)/;
const expectedFirstPublicItemIds = [
  "redacted-document-pinned-low",
  "redacted-document-pinned-high",
  "redacted-document-standard-low-newer"
];
const expectedChecks = [
  "sourceValidation",
  "d1RowValidation",
  "snapshotContract",
  "ordering",
  "fieldLeakage",
  "redactedInputSafety"
].sort();
const expectedSafetyFlags = [
  "d1Writes",
  "productionCommands",
  "networkCalls",
  "realProductionData",
  "realGoogleDriveUrls",
  "d1IdsCommitted",
  "appsScriptChanged",
  "googleApiChanged",
  "uiRoutesCacheChanged"
].sort();

const validRecord = {
  id: "redacted-document-test-001",
  title: "Redacted local manifest document",
  description: "Fake manifest document only.",
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

async function sha256(value: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function runWithRawInput(rawInput: string, args: string[] = []) {
  return runPublicDocumentsImportManifestDryRun(["--input", "redacted-manifest.json", ...args], {
    readFile: async () => rawInput
  });
}

async function runWithRecords(records: unknown[], args: string[] = []) {
  return runWithRawInput(JSON.stringify(records), args);
}

function expectSafeManifestOutput(output: string) {
  expect(output).not.toMatch(fullFileUrlPattern);
  expect(output).not.toMatch(forbiddenProductionPattern);
  expect(output).not.toMatch(realD1IdPattern);
  expect(output).not.toContain("Redacted local manifest document");
  expect(output).not.toContain("Fake manifest document only.");
}

describe("M12 public document import manifest dry-run CLI", () => {
  it("script exists and is exposed through root and worker package scripts", () => {
    const rootPackageJson = JSON.parse(rootPackageJsonSource);
    const workerPackageJson = JSON.parse(workerPackageJsonSource);

    expect(manifestScriptSource).toContain("runPublicDocumentsImportManifestDryRun");
    expect(rootPackageJson.scripts["worker:public-documents:import:manifest"]).toBe(
      "node cloudflare/public-api/scripts/public-documents-import-manifest-dry-run.mjs"
    );
    expect(workerPackageJson.scripts["public-documents:import:manifest"]).toBe(
      "node scripts/public-documents-import-manifest-dry-run.mjs"
    );
  });

  it("default manifest dry-run returns READY with checksum, counts, checks, safety flags, and no record leakage", async () => {
    const result = await runPublicDocumentsImportManifestDryRun([]);
    const output = formatPublicDocumentsImportManifestDryRunResult(result);
    const fixtureChecksum = await sha256(rawFixture);

    expect(result.status).toBe("READY");
    expect(result.manifest.manifestVersion).toBe(1);
    expect(result.manifest.checkpoint).toBe("M12");
    expect(result.manifest.scope).toBe("public-document-list");
    expect(result.manifest.status).toBe("READY");
    expect(result.manifest.input).toEqual({
      path: defaultInputPath,
      sha256: fixtureChecksum,
      sourceType: "redacted-fixture"
    });
    expect(result.manifest.dryRun).toMatchObject({
      sourceRecordCount: 6,
      transformedRowCount: 6,
      publicItemCount: 5,
      excludedDraftInactiveCount: 1,
      validationErrorCount: 0,
      firstPublicItemIds: expectedFirstPublicItemIds
    });
    expect(new Date(result.manifest.dryRun.generatedAt ?? "").toISOString()).toBe(result.manifest.dryRun.generatedAt);
    expect(Object.keys(result.manifest.checks).sort()).toEqual(expectedChecks);
    expect(Object.values(result.manifest.checks)).toEqual(expectedChecks.map(() => "passed"));
    expect(Object.keys(result.manifest.safety).sort()).toEqual(expectedSafetyFlags);
    Object.values(result.manifest.safety).forEach((value) => expect(value).toBe(false));
    expect(result.manifest.validationIssues).toEqual([]);
    expect(output).toContain("READY");
    expect(output).toContain("Manifest version: 1");
    expect(output).toContain("Checkpoint: M12");
    expect(output).toContain("Scope: public-document-list");
    expect(output).toContain(`Input path: ${defaultInputPath}`);
    expect(output).toContain(`Input SHA-256: ${fixtureChecksum}`);
    expect(output).toContain("Checks:");
    expect(output).toContain("No D1 writes were run.");
    expect(output).toContain("No production commands were run.");
    expect(output).toContain("No network calls were made.");
    expectSafeManifestOutput(output);
  });

  it("--json prints valid safe JSON manifest only", async () => {
    const result = await runPublicDocumentsImportManifestDryRun(["--json"]);
    const output = formatPublicDocumentsImportManifestDryRunResult(result, { json: true });
    const manifest = JSON.parse(output);

    expect(manifest.status).toBe("READY");
    expect(manifest.checkpoint).toBe("M12");
    expect(manifest.dryRun.firstPublicItemIds).toEqual(expectedFirstPublicItemIds);
    expect(manifest).not.toHaveProperty("snapshot");
    expect(output).not.toContain("items");
    expectSafeManifestOutput(output);
  });

  it("returns BLOCKED for malformed JSON and non-array JSON with safe validation issues", async () => {
    const malformed = await runWithRawInput("{not-json");
    const nonArray = await runWithRawInput(JSON.stringify({ records: [] }));

    expect(malformed.status).toBe("BLOCKED");
    expect(malformed.manifest.status).toBe("BLOCKED");
    expect(malformed.manifest.checks.sourceValidation).toBe("blocked");
    expect(malformed.manifest.validationIssues).toContainEqual({ index: null, messages: ["input must be valid JSON"] });
    expect(nonArray.status).toBe("BLOCKED");
    expect(nonArray.manifest.validationIssues).toContainEqual({
      index: null,
      messages: ["input JSON must be an array"]
    });
    expectSafeManifestOutput(formatPublicDocumentsImportManifestDryRunResult(malformed));
    expectSafeManifestOutput(JSON.stringify(nonArray.manifest));
  });

  it("returns BLOCKED for invalid records, forbidden URLs, D1 ids, unknown fields, unsafe fileName, and unsafe mediaId", async () => {
    const result = await runWithRecords([
      { ...validRecord, title: "" },
      { ...validRecord, fileUrl: forbiddenDriveUrl },
      { ...validRecord, mediaId: d1IdLookingValue },
      { ...validRecord, extraField: "blocked" },
      { ...validRecord, fileName: "../blocked.exe" },
      { ...validRecord, mediaId: "https://files.example.test/media/blocked" }
    ]);
    const output = formatPublicDocumentsImportManifestDryRunResult(result);

    expect(result.status).toBe("BLOCKED");
    expect(result.manifest.checks.sourceValidation).toBe("blocked");
    expect(output).toContain("record[0]");
    expect(output).toContain("title is required");
    expect(output).toContain("fileUrl contains a forbidden URL");
    expect(output).toContain("mediaId must not contain a D1 id pattern");
    expect(output).toContain("unknown source field: extraField");
    expect(output).toContain("fileName must not contain path traversal");
    expect(output).toContain("mediaId must not be URL-like");
    expect(result.manifest.validationIssues.every((issue) => typeof issue.index === "number")).toBe(true);
    expectSafeManifestOutput(output);
    expectSafeManifestOutput(JSON.stringify(result.manifest));
  });

  it("--generated-at makes generatedAt deterministic and invalid values return BLOCKED", async () => {
    const deterministic = await runPublicDocumentsImportManifestDryRun(["--generated-at", fixedGeneratedAt]);
    const invalid = await runPublicDocumentsImportManifestDryRun(["--generated-at", "2026-06-11"]);

    expect(deterministic.status).toBe("READY");
    expect(deterministic.manifest.dryRun.generatedAt).toBe(fixedGeneratedAt);
    expect(invalid.status).toBe("BLOCKED");
    expect(invalid.manifest.dryRun.generatedAt).toBeNull();
    expect(invalid.manifest.validationIssues).toContainEqual({
      index: null,
      messages: ["--generated-at must be a strict ISO string"]
    });
  });

  it("input checksum changes when input contents change", async () => {
    const firstRawInput = JSON.stringify([validRecord]);
    const secondRawInput = JSON.stringify([{ ...validRecord, id: "redacted-document-test-002" }]);
    const first = await runWithRawInput(firstRawInput, ["--generated-at", fixedGeneratedAt]);
    const second = await runWithRawInput(secondRawInput, ["--generated-at", fixedGeneratedAt]);

    expect(first.status).toBe("READY");
    expect(second.status).toBe("READY");
    expect(first.manifest.input.sha256).toBe(await sha256(firstRawInput));
    expect(second.manifest.input.sha256).toBe(await sha256(secondRawInput));
    expect(first.manifest.input.sha256).not.toBe(second.manifest.input.sha256);
  });

  it("keeps source local-only, committed config safe, and the current Cloudflare frontend contract intact", () => {
    expect(manifestScriptSource).not.toMatch(/\bfetch\s*\(/);
    expect(manifestScriptSource).not.toMatch(/\bXMLHttpRequest\b/);
    expect(manifestScriptSource).not.toMatch(/\bwrangler\b/i);
    expect(manifestScriptSource).not.toMatch(/\bvercel\b/i);
    expect(manifestScriptSource).not.toMatch(/\bcurl\b/i);
    expect(manifestScriptSource).not.toMatch(/\bchild_process\b/);
    expect(manifestScriptSource).not.toMatch(/\bexec(?:File|Sync)?\s*\(/);
    expect(manifestScriptSource).not.toMatch(/\bspawn(?:Sync)?\s*\(/);
    expect(manifestScriptSource).not.toMatch(/\bd1\s+(?:execute|migrations)\b/i);
    expect(manifestScriptSource).not.toMatch(/AppsScript|googleApi/i);
    expect(manifestScriptSource).not.toMatch(forbiddenProductionPattern);
    expect(manifestScriptSource).not.toMatch(realD1IdPattern);
    expect(wranglerToml).toContain('database_id = "local-placeholder"');
    expect(wranglerToml).toContain('database_id = "production-placeholder"');
    expect(publicApiProviderSource).toMatch(/VITE_CLOUDFLARE_PUBLIC_API_URL/);
    expect(publicApiProviderSource).toMatch(/CLOUDFLARE_PUBLIC_API_URL/);
    expect(publicApiProviderSource).not.toMatch(/VITE_PUBLIC_API_PROVIDER/);
    expect(publicApiProviderSource).not.toMatch(/apps-script/);
  });

  it("documents M12 local manifest scope and production safety", () => {
    expect(m12Doc).toMatch(
      /Status: local import artifact manifest dry-run only\. No D1 writes, production import, deployment, or cutover is executed\./i
    );
    expect(m12Doc).toContain("pnpm worker:public-documents:import:manifest");
    expect(m12Doc).toMatch(/Manifest Contents/i);
    expect(m12Doc).toMatch(/Input Safety/i);
    expect(m12Doc).toMatch(/Output Safety/i);
    expect(m12Doc).toMatch(/Validation Scope/i);
    expect(m12Doc).toMatch(/Relationship to M13/i);
    expect(m12Doc).not.toMatch(forbiddenProductionPattern);
    expect(m12Doc).not.toMatch(realD1IdPattern);
  });
});
