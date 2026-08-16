import { describe, expect, it } from "vitest";
import auditSql from "../../cloudflare/public-api/sql/production-fixture-audit.sql?raw";
import homeAuditSql from "../../cloudflare/public-api/sql/production-home-section-fixture-audit.sql?raw";
import cleanupSql from "../../cloudflare/public-api/sql/production-fixture-cleanup.sql?raw";
import homeCleanupSql from "../../cloudflare/public-api/sql/production-home-section-fixture-cleanup.sql?raw";
import integrityWorkflow from "../../.github/workflows/production-data-integrity.yml?raw";
import workerProductionWorkflow from "../../.github/workflows/worker-production.yml?raw";
import parserSource from "../../scripts/check-production-fixture-audit.mjs?raw";
import diagnosticSanitizerSource from "../../scripts/sanitize-cloudflare-cli-output.mjs?raw";

const baseFixtureIds = [
  "sample-public-read-document-001",
  "sample-public-read-content-001",
  "sample-public-read-program-001"
];
const homeFixtureId = "sample-public-read-home-section-001";
const auditFilePath = "cloudflare/public-api/sql/production-fixture-audit.sql";
const homeAuditFilePath = "cloudflare/public-api/sql/production-home-section-fixture-audit.sql";

describe("P5A production data-integrity safety", () => {
  it("keeps pre-migration and optional home audits read-only and exact", () => {
    for (const sql of [auditSql, homeAuditSql]) {
      expect(sql).toMatch(/^-- P5A/m);
      expect(sql).not.toMatch(/\b(?:delete|update|insert|replace|drop|alter|create)\b/i);
      expect(sql).not.toMatch(/\bunion\b/i);
    }
    expect(auditSql).toContain("json_each('[0,1,2,3,4]')");
    baseFixtureIds.forEach((id) => expect(auditSql).toContain(id));
    expect(auditSql).not.toContain("FROM public_home_sections");
    expect(auditSql).toContain("2026-06-13");
    expect(auditSql).toContain("2026-01-01");
    expect(homeAuditSql).toContain("FROM public_home_sections");
    expect(homeAuditSql).toContain(homeFixtureId);
  });

  it("inspects schema before fixture queries and treats public_home_sections as migration-optional", () => {
    for (const workflow of [integrityWorkflow, workerProductionWorkflow]) {
      expect(workflow).toContain("FROM sqlite_master");
      expect(workflow).toContain('required = ["documents", "contents", "visitor_daily_stats"]');
      expect(workflow).toContain("PUBLIC_HOME_SECTIONS_PRESENT");
      expect(workflow).toContain("public_home_sections");
      expect(workflow).toContain("schema inspection failed");
    }
    expect(integrityWorkflow).toContain("public_home_sections present before migration");
    expect(workerProductionWorkflow).toContain("public_home_sections present before migrations");
  });

  it("uses the D1 query path for read-only audits instead of the import path", () => {
    for (const workflow of [integrityWorkflow, workerProductionWorkflow]) {
      expect(workflow).toContain(`audit_sql="$(cat ${auditFilePath})"`);
      expect(workflow).toContain(`audit_sql="$(cat ${homeAuditFilePath})"`);
      expect(workflow).toContain('--command="$audit_sql"');
      expect(workflow).not.toContain('--command "$audit_sql"');
      expect(workflow).not.toContain(`--file ${auditFilePath}`);
      expect(workflow).not.toContain(`--file ${homeAuditFilePath}`);
    }
  });

  it("allows cleanup only through exact predicates and D1-compatible import SQL", () => {
    for (const sql of [cleanupSql, homeCleanupSql]) {
      expect(sql).not.toMatch(/\b(?:begin\s+transaction|commit|savepoint)\b/i);
      expect(sql).not.toMatch(/\bdelete\s+from\s+\w+\s*;/i);
      expect(sql).not.toMatch(/\b(?:like|glob)\b/i);
      expect(sql).not.toMatch(/delete\s+from\s+(?:site_settings|homepage_settings|menu_items|media_assets)\b/i);
    }
    baseFixtureIds.forEach((id) => expect(cleanupSql).toContain(id));
    expect(cleanupSql).not.toContain("DELETE FROM public_home_sections");
    expect(homeCleanupSql).toContain("DELETE FROM public_home_sections");
    expect(homeCleanupSql).toContain(homeFixtureId);
    expect(integrityWorkflow).toContain("production-home-section-fixture-cleanup.sql");
    expect(integrityWorkflow).toContain("env.PUBLIC_HOME_SECTIONS_PRESENT == 'true'");
  });

  it("requires master, the protected production environment, a bookmark, and explicit cleanup confirmation", () => {
    expect(integrityWorkflow).toContain("github.ref == 'refs/heads/master'");
    expect(integrityWorkflow).toMatch(/environment:\s*production/);
    expect(integrityWorkflow).toContain("PRODUCTION_D1_RESOURCE_NAME: rcat-public-api-preview");
    expect(integrityWorkflow).toContain('d1 time-travel info "$PRODUCTION_D1_RESOURCE_NAME"');
    expect(integrityWorkflow).toContain("DELETE_CONFIRMED_LOCAL_FIXTURES_ONLY");
    expect(integrityWorkflow).toContain("inputs.mode == 'cleanup'");
    expect(integrityWorkflow).toContain("production-fixture-cleanup.sql");
    expect(integrityWorkflow).toContain("--expect-clean");
    expect(integrityWorkflow).not.toMatch(/d1\s+time-travel\s+restore/i);
  });

  it("surfaces sanitized Wrangler diagnostics without weakening the production gates", () => {
    expect(integrityWorkflow).toContain("production-fixture-audit.stderr");
    expect(integrityWorkflow).toContain("production-fixture-schema.stderr");
    expect(integrityWorkflow).toContain("sanitize-cloudflare-cli-output.mjs");
    expect(integrityWorkflow).toContain("wrangler stdout");
    expect(integrityWorkflow).toContain("wrangler stderr");
    expect(integrityWorkflow).toContain('exit "$audit_status"');
    expect(workerProductionWorkflow).toContain("production-fixture-audit.stderr");
    expect(workerProductionWorkflow).toContain("production-fixture-schema.stderr");
    expect(workerProductionWorkflow).toContain("sanitize-cloudflare-cli-output.mjs");
    expect(workerProductionWorkflow).toContain('exit "$audit_status"');
    expect(diagnosticSanitizerSource).toContain("sanitizeCloudflareCliOutput");
    expect(diagnosticSanitizerSource).toContain("CLOUDFLARE_");
    expect(diagnosticSanitizerSource).toContain("authorization");
    expect(diagnosticSanitizerSource).toContain("diagnostic output truncated");
  });

  it("blocks Worker production releases on any fixture in tables present before migrations", () => {
    expect(workerProductionWorkflow).toContain("production-fixture-audit.sql");
    expect(workerProductionWorkflow).toContain("production-home-section-fixture-audit.sql");
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
