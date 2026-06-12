import { describe, expect, it, vi } from "vitest";
import m13Doc from "../../../docs/architecture/m13-public-document-list-controlled-production-import-2026-06-11.md?raw";
import rootPackageJsonSource from "../../../package.json?raw";
import publicApiProviderSource from "../../../src/config/publicApiProvider.ts?raw";
import {
  formatPublicDocumentsProductionImportResult,
  runPublicDocumentsProductionImport
} from "../scripts/public-documents-production-import.mjs";
import productionImportSource from "../scripts/public-documents-production-import.mjs?raw";
import workerPackageJsonSource from "../package.json?raw";
import wranglerToml from "../wrangler.toml?raw";

const fixedGeneratedAt = "2026-06-11T00:00:00.000Z";
const fakeInputPath = "C:/operator/secure/public-documents-prod-export.redacted.json";
const forbiddenProductionPattern = new RegExp(
  [`${"script"}.${"google"}.com`, `${"drive"}.${"google"}.com`, `${"rcat"}.ac.th`]
    .map((value) => value.replaceAll(".", "\\."))
    .join("|"),
  "i"
);
const realD1IdPattern = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const validProdD1Id = ["123e4567", "e89b", "42d3", "a456", "426614174999"].join("-");
const d1IdLookingValue = ["123e4567", "e89b", "12d3", "a456", "426614174000"].join("-");
const forbiddenDriveUrl = `https://${"drive"}.${"google"}.com/file/example`;
const fullFileUrlPattern = /https:\/\/files\.example\.(?:test|invalid)/;
const expectedFirstPublicItemIds = ["redacted-prod-doc-001", "redacted-prod-doc-002"];
const expectedValidationKeys = [
  "sourceValidation",
  "d1RowValidation",
  "snapshotContract",
  "ordering",
  "fieldLeakage"
].sort();
const expectedSafetyKeys = [
  "frontendCutover",
  "vercelEnvChanged",
  "appsScriptChanged",
  "googleApiChanged",
  "uiRoutesCacheChanged",
  "productionWorkerDeploy",
  "schemaMigration"
].sort();

const validRecords = [
  {
    id: "redacted-prod-doc-001",
    title: "Redacted production import document one",
    description: "Sensitive description should never print.",
    category: "policy",
    fileUrl: "https://files.example.test/prod-documents/redacted-one.pdf",
    fileName: "redacted-one.pdf",
    mediaId: "redacted-media-one",
    publishedAt: "2026-06-11T08:00:00.000Z",
    order: 1,
    pinned: true,
    updatedAt: "2026-06-11T09:00:00.000Z",
    status: "published"
  },
  {
    id: "redacted-prod-doc-002",
    title: "Redacted production import document two",
    description: "Another sensitive description should never print.",
    category: "policy",
    fileUrl: "https://files.example.test/prod-documents/redacted-two.pdf",
    fileName: "redacted-two.pdf",
    mediaId: "redacted-media-two",
    publishedAt: "2026-06-10T08:00:00.000Z",
    order: 2,
    pinned: false,
    updatedAt: "2026-06-10T09:00:00.000Z",
    status: "published"
  }
];

const validEnv = {
  RCAT_PROD_D1_DATABASE_NAME: "rcat-public-api-production",
  RCAT_PROD_D1_DATABASE_ID: validProdD1Id,
  RCAT_PROD_IMPORT_APPROVAL: "APPROVED_PRODUCTION_D1_IMPORT",
  RCAT_PROD_IMPORT_OPERATOR: "redacted-operator"
};

async function sha256(value: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function runWithRawInput(rawInput: string, args: string[] = [], options: Record<string, unknown> = {}) {
  return runPublicDocumentsProductionImport(["--input", fakeInputPath, "--generated-at", fixedGeneratedAt, ...args], {
    env: {},
    readFile: async () => rawInput,
    ...options
  });
}

function runWithRecords(records: unknown[], args: string[] = [], options: Record<string, unknown> = {}) {
  return runWithRawInput(JSON.stringify(records), args, options);
}

function expectSafeOutput(output: string) {
  expect(output).not.toMatch(fullFileUrlPattern);
  expect(output).not.toMatch(forbiddenProductionPattern);
  expect(output).not.toContain(validProdD1Id);
  expect(output).not.toContain("Redacted production import document one");
  expect(output).not.toContain("Sensitive description should never print.");
  expect(output).not.toContain("redacted-one.pdf");
  expect(output).not.toMatch(/INSERT INTO documents/i);
}

describe("M13 controlled public document production import runner", () => {
  it("script exists and is exposed through root and worker package scripts", () => {
    const rootPackageJson = JSON.parse(rootPackageJsonSource);
    const workerPackageJson = JSON.parse(workerPackageJsonSource);

    expect(productionImportSource).toContain("runPublicDocumentsProductionImport");
    expect(rootPackageJson.scripts["worker:public-documents:import:prod"]).toBe(
      "node cloudflare/public-api/scripts/public-documents-production-import.mjs"
    );
    expect(workerPackageJson.scripts["public-documents:import:prod"]).toBe(
      "node scripts/public-documents-production-import.mjs"
    );
  });

  it("returns READY_DRY_RUN for valid fake input without writes", async () => {
    const rawInput = JSON.stringify(validRecords);
    const execute = vi.fn();
    const result = await runWithRawInput(rawInput, [], { execute });
    const output = formatPublicDocumentsProductionImportResult(result);

    expect(result.status).toBe("READY_DRY_RUN");
    expect(result.manifest).toMatchObject({
      checkpoint: "M13",
      scope: "public-document-list",
      mode: "dry-run",
      status: "READY_DRY_RUN"
    });
    expect(result.manifest.input).toMatchObject({
      pathLabel: "public-documents-prod-export.redacted.json",
      sha256: await sha256(rawInput),
      sourceRecordCount: 2
    });
    expect(Object.keys(result.manifest.validation).sort()).toEqual(expectedValidationKeys);
    expect(Object.values(result.manifest.validation)).toEqual(expectedValidationKeys.map(() => "passed"));
    expect(result.manifest.import).toMatchObject({
      targetDatabaseNameLabel: "not-provided",
      targetDatabaseIdRedacted: null,
      rowCount: 2,
      batchCount: 1,
      executedAt: null
    });
    expect(Object.keys(result.manifest.safety).sort()).toEqual(expectedSafetyKeys);
    Object.values(result.manifest.safety).forEach((value) => expect(value).toBe(false));
    expect(result.manifest.validationIssues).toEqual([]);
    expect(result.manifest.firstPublicItemIds).toEqual(expectedFirstPublicItemIds);
    expect(execute).not.toHaveBeenCalled();
    expect(output).toContain("READY_DRY_RUN");
    expect(output).toContain("No D1 writes were run.");
    expect(output).toContain("No frontend cutover was performed.");
    expectSafeOutput(output);
  });

  it("blocks execute without required env vars or exact approval phrase", async () => {
    const execute = vi.fn();
    const missingEnv = await runWithRecords(validRecords, ["--execute"], { execute });
    const wrongApproval = await runWithRecords(validRecords, ["--execute"], {
      execute,
      env: { ...validEnv, RCAT_PROD_IMPORT_APPROVAL: "approved" }
    });

    expect(missingEnv.status).toBe("BLOCKED");
    expect(missingEnv.manifest.validationIssues).toEqual(
      expect.arrayContaining([
        { index: null, messages: ["missing env: RCAT_PROD_D1_DATABASE_NAME"] },
        { index: null, messages: ["missing env: RCAT_PROD_D1_DATABASE_ID"] },
        { index: null, messages: ["missing env: RCAT_PROD_IMPORT_APPROVAL"] }
      ])
    );
    expect(wrongApproval.status).toBe("BLOCKED");
    expect(wrongApproval.manifest.validationIssues).toContainEqual({
      index: null,
      messages: ["RCAT_PROD_IMPORT_APPROVAL must exactly match APPROVED_PRODUCTION_D1_IMPORT"]
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("requires production-looking D1 name and rejects non-production names", async () => {
    const cases = [
      "rcat-public-api",
      "rcat-public-api-preview",
      "rcat-public-api-local",
      "rcat-public-api-dev",
      "rcat-public-api-test",
      "rcat-public-api-staging",
      "rcat-public-api-sandbox"
    ];

    for (const databaseName of cases) {
      const result = await runWithRecords(validRecords, ["--execute"], {
        env: { ...validEnv, RCAT_PROD_D1_DATABASE_NAME: databaseName }
      });

      expect(result.status, databaseName).toBe("BLOCKED");
      expect(
        result.manifest.validationIssues.some((issue) =>
          issue.messages.some((message) => message.includes("D1 database name"))
        )
      ).toBe(true);
    }
  });

  it("rejects placeholder and malformed D1 ids while redacting valid ids in output", async () => {
    const placeholder = await runWithRecords(validRecords, ["--execute"], {
      env: { ...validEnv, RCAT_PROD_D1_DATABASE_ID: "preview-placeholder" }
    });
    const malformed = await runWithRecords(validRecords, ["--execute"], {
      env: { ...validEnv, RCAT_PROD_D1_DATABASE_ID: "not-a-uuid" }
    });
    const execute = vi.fn(async () => ({ code: 0 }));
    const executed = await runWithRecords(validRecords, ["--execute"], {
      env: validEnv,
      execute,
      writeTempSql: async () => "C:/Temp/redacted.sql",
      cleanupTempSql: vi.fn()
    });
    const output = formatPublicDocumentsProductionImportResult(executed, { json: true });

    expect(placeholder.status).toBe("BLOCKED");
    expect(malformed.status).toBe("BLOCKED");
    expect(executed.status).toBe("IMPORTED");
    expect(executed.manifest.import.targetDatabaseIdRedacted).toBe("123e...4999");
    expect(output).not.toContain(validProdD1Id);
    expectSafeOutput(output);
  });

  it("blocks invalid input before execute and reports safe indexed validation issues", async () => {
    const result = await runWithRecords(
      [
        { ...validRecords[0], status: "archived" },
        { ...validRecords[0], fileUrl: forbiddenDriveUrl },
        { ...validRecords[0], mediaId: d1IdLookingValue },
        { ...validRecords[0], extraField: "blocked" },
        { ...validRecords[0], fileName: "../blocked.exe" },
        { ...validRecords[0], mediaId: "https://files.example.test/media/blocked" },
        { ...validRecords[0], publishedAt: "2026-06-11" },
        { ...validRecords[0], order: -1 },
        { ...validRecords[0], pinned: "yes" }
      ],
      ["--execute"],
      { env: validEnv, execute: vi.fn() }
    );
    const output = formatPublicDocumentsProductionImportResult(result);

    expect(result.status).toBe("BLOCKED");
    expect(result.manifest.validation.sourceValidation).toBe("blocked");
    expect(result.manifest.validationIssues.length).toBeGreaterThan(0);
    expect(output).toContain("record[0]");
    expect(output).toContain("status must be one of: published, draft, inactive");
    expect(output).toContain("fileUrl contains a forbidden URL");
    expect(output).toContain("mediaId must not contain a D1 id pattern");
    expect(output).toContain("unknown source field: extraField");
    expect(output).toContain("fileName must not contain path traversal");
    expect(output).toContain("mediaId must not be URL-like");
    expect(output).toContain("publishedAt must be a valid ISO string");
    expect(output).toContain("order must be a non-negative integer");
    expect(output).toContain("pinned must be boolean-compatible");
    expectSafeOutput(output);
  });

  it("blocks repository-tracked input paths but allows ignored temp paths", async () => {
    const blocked = await runPublicDocumentsProductionImport(
      ["--input", "cloudflare/public-api/test/fixtures/public-documents.import-source.redacted.json"],
      { readFile: async () => JSON.stringify(validRecords) }
    );
    const allowed = await runPublicDocumentsProductionImport(["--input", "tmp/public-documents-prod.redacted.json"], {
      readFile: async () => JSON.stringify(validRecords)
    });

    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.manifest.validationIssues).toContainEqual({
      index: null,
      messages: ["input path inside repository must be under an ignored temp path"]
    });
    expect(allowed.status).toBe("READY_DRY_RUN");
  });

  it("mock execute path calls injected dependencies only after gates pass and uses remote Wrangler execution", async () => {
    const execute = vi.fn(async () => ({ code: 0 }));
    const cleanupTempSql = vi.fn(async () => undefined);
    const writeTempSql = vi.fn(async (sql: string) => {
      expect(sql).toContain("BEGIN TRANSACTION;");
      expect(sql).toContain("DELETE FROM documents;");
      expect(sql).toContain("COMMIT;");

      return "C:/Temp/redacted-production-import.sql";
    });

    const result = await runWithRecords(validRecords, ["--execute"], {
      env: validEnv,
      execute,
      writeTempSql,
      cleanupTempSql
    });

    expect(result.status).toBe("IMPORTED");
    expect(result.manifest.mode).toBe("execute");
    expect(result.manifest.import).toMatchObject({
      targetDatabaseNameLabel: "rcat-public-api-production",
      targetDatabaseIdRedacted: "123e...4999",
      rowCount: 2,
      batchCount: 1,
      executedAt: fixedGeneratedAt
    });
    expect(writeTempSql).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    const executeCalls = execute.mock.calls as unknown as Array<[{ command: string; args: string[] }]>;
    const executeCall = executeCalls[0]?.[0];

    expect(executeCall).toMatchObject({
      command: "wrangler",
      args: expect.arrayContaining(["d1", "execute", "rcat-public-api-production", "--remote", "--file"])
    });
    expect(cleanupTempSql).toHaveBeenCalledWith("C:/Temp/redacted-production-import.sql");
    expectSafeOutput(formatPublicDocumentsProductionImportResult(result));
  });

  it("returns FAILED and cleanup still runs when approved execute command fails", async () => {
    const cleanupTempSql = vi.fn(async () => undefined);
    const result = await runWithRecords(validRecords, ["--execute"], {
      env: validEnv,
      execute: vi.fn(async () => ({ code: 1 })),
      writeTempSql: async () => "C:/Temp/redacted-production-import.sql",
      cleanupTempSql
    });

    expect(result.status).toBe("FAILED");
    expect(result.manifest.validationIssues).toContainEqual({
      index: null,
      messages: ["wrangler d1 execute failed"]
    });
    expect(cleanupTempSql).toHaveBeenCalledWith("C:/Temp/redacted-production-import.sql");
  });

  it("keeps committed config, frontend default, Apps Script, googleApi, UI/routes/cache unchanged", () => {
    expect(wranglerToml).toContain('database_id = "local-placeholder"');
    expect(wranglerToml).toContain('database_id = "preview-placeholder"');
    expect(wranglerToml).not.toMatch(realD1IdPattern);
    expect(publicApiProviderSource).toContain('return provider === "cloudflare" ? "cloudflare" : "apps-script"');
    expect(productionImportSource).not.toMatch(forbiddenProductionPattern);
    expect(productionImportSource).not.toContain(validProdD1Id);
  });

  it("documents that M13 is not frontend cutover and does not authorize later checkpoints", () => {
    expect(m13Doc).toMatch(
      /Status: controlled production D1 import checkpoint only\. Production frontend cutover is not approved or executed\./i
    );
    expect(m13Doc).toMatch(
      /M13 may write validated `public-document-list` rows into production D1 only after explicit approval/i
    );
    expect(m13Doc).toMatch(/does not switch frontend to Cloudflare/i);
    expect(m13Doc).toMatch(/does not change Vercel production env/i);
    expect(m13Doc).toMatch(/does not deploy production Worker/i);
    expect(m13Doc).toMatch(/Apps Script remains production source of truth/i);
    expect(m13Doc).toMatch(/does not authorize M14\/M15/i);
    expect(m13Doc).not.toMatch(forbiddenProductionPattern);
    expect(m13Doc).not.toMatch(realD1IdPattern);
  });
});
