import { describe, expect, it } from "vitest";
import auditSql from "../../cloudflare/public-api/sql/production-fixture-audit.sql?raw";
import cleanupSql from "../../cloudflare/public-api/sql/production-fixture-cleanup.sql?raw";
import integrityWorkflow from "../../.github/workflows/production-data-integrity.yml?raw";
import workerProductionWorkflow from "../../.github/workflows/worker-production.yml?raw";
import parserSource from "../../scripts/check-production-fixture-audit.mjs?raw";
import diagnosticSanitizerSource from "../../scripts/sanitize-cloudflare-cli-output.mjs?raw";

const exactFixtureIds = [
  "sample-public-read-home-section-001",
  "sample-public-read-document-001",
  "sample-public-read-content-001",
  "sample-public-read-program-001"
];

const auditFilePath = "cloudflare/public-api/sql/production-fixture-audit.sql";

describe("P5A production data-integrity safety", () => {
  it("keeps the production audit read-only and scoped to exact fixture identities", () => {
    expect(auditSql).toMatch(/^-- P5A production data-integrity sentinel/m);
    expect(auditSql).not.toMatch(/\b(?:delete|update|insert|replace|drop|alter|create)\b/i);
    exactFixtureIds.forEach((id) => expect(auditSql).toContain(id));
    expect(auditSql).toContain("2026-06-13");
    expect(auditSql).toContain("2026-01-01");
  });

  it("uses the D1 query path for read-only audits instead of the import path", () => {
    for (const workflow of [integrityWorkflow, workerProductionWorkflow]) {
      expect(workflow).toContain(`audit_sql="$(cat ${auditFilePath})"`);
      expect(workflow).toContain('--command "$audit_sql"');
      expect(workflow).not.toContain(`--file ${auditFilePath}`);
    }
  });

  it("allows cleanup only through exact predicates and never wildcard deletes", () => {
    expect(cleanupSql).toContain("BEGIN TRANSACTION;");
    expect(cleanupSql).toContain("COMMIT;");
    exactFixtureIds.forEach((id) => expect(cleanupSql).toContain(id));
    expect(cleanupSql).not.toMatch(/\bdelete\s+from\s+\w+\s*;/i);
    expect(cleanupSql).not.toMatch(/\b(?:like|glob)\b/i);
    expect(cleanupSql).not.toMatch(/delete\s+from\s+(?:site_settings|homepage_settings|menu_items|media_assets)\b/i);
  });

  it("requires master, the protected production environment, a bookmark, and explicit cleanup confirmation", () => {
    expect(integrityWorkflow).toContain("github.ref == 'refs/heads/master'");
    expect(integrityWorkflow).toMatch(/environment:\s*production/);
    expect(integrityWorkflow).toContain("d1 time-travel info rcat-public-api-production");
    expect(integrityWorkflow).toContain("DELETE_CONFIRMED_LOCAL_FIXTURES_ONLY");
    expect(integrityWorkflow).toContain("inputs.mode == 'cleanup'");
    expect(integrityWorkflow).toContain("production-fixture-cleanup.sql");
    expect(integrityWorkflow).toContain("--expect-clean");
    expect(integrityWorkflow).not.toMatch(/d1\s+time-travel\s+restore/i);
  });

  it("surfaces sanitized Wrangler diagnostics without weakening the production gates", () => {
    expect(integrityWorkflow).toContain("production-fixture-audit.stderr");
    expect(integrityWorkflow).toContain("sanitize-cloudflare-cli-output.mjs");
    expect(integrityWorkflow).toContain("wrangler stdout");
    expect(integrityWorkflow).toContain("wrangler stderr");
    expect(integrityWorkflow).toContain('exit "$audit_status"');
    expect(workerProductionWorkflow).toContain("production-fixture-audit.stderr");
    expect(workerProductionWorkflow).toContain("sanitize-cloudflare-cli-output.mjs");
    expect(workerProductionWorkflow).toContain('exit "$audit_status"');
    expect(diagnosticSanitizerSource).toContain("sanitizeCloudflareCliOutput");
    expect(diagnosticSanitizerSource).toContain("CLOUDFLARE_");
    expect(diagnosticSanitizerSource).toContain("authorization");
    expect(diagnosticSanitizerSource).toContain("diagnostic output truncated");
  });

  it("blocks Worker production releases until the exact fixture sentinel is clean", () => {
    expect(workerProductionWorkflow).toContain("production-fixture-audit.sql");
    expect(workerProductionWorkflow).toContain("check-production-fixture-audit.mjs");
    expect(workerProductionWorkflow).toContain("--expect-clean");
  });

  it("parses only named audit rows and can fail closed when fixtures remain", () => {
    expect(parserSource).toContain("row.source");
    expect(parserSource).toContain("row.fixture_key");
    expect(parserSource).toContain("expectClean");
    expect(parserSource).toContain("production fixture sentinel failed");
  });
});
