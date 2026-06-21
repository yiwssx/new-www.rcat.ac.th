// @vitest-environment node
import { describe, expect, it } from "vitest";
import currentStatus from "../../../docs/architecture/current-migration-status.md?raw";
import m20Doc from "../../../docs/architecture/m20-production-readiness-gate.md?raw";
import m20Runbook from "../../../docs/operations/m20-readiness-runbook.md?raw";
import rootPackage from "../../../package.json";
import workerPackage from "../package.json";
import { formatM20ReadinessGate, runM20ReadinessGate } from "../scripts/m20-readiness-gate.mjs";

const repositoryFixture = {
  "docs/architecture/current-migration-status.md": [
    "M19 remains CLOSED.",
    "M19: `CLOSED` for repository-owned parity remediation.",
    "M20: `APPROVED_FOR_PREVIEW_BACKED_FIELD_VERIFICATION`.",
    "Admin structured data provider: Cloudflare.",
    "Public client data provider: Cloudflare.",
    "Media/attachment/file provider: Google Drive via Apps Script bridge.",
    "Database environment: preview D1 during field verification.",
    "Production D1 / final production cutover: explicitly deferred to operator decision after field verification."
  ].join("\n"),
  "docs/architecture/m19-parity-gap-assessment-2026-06-19.md":
    "Status: CLOSED for repository-owned M19 parity remediation.",
  "docs/architecture/m20-production-readiness-gate.md": [
    "# M20 Production Readiness Gate",
    "Current state after M19",
    "M19 is closed.",
    "M20 is APPROVED_FOR_PREVIEW_BACKED_FIELD_VERIFICATION.",
    "APPROVED_FOR_PREVIEW_FIELD_VERIFICATION_ONLY.",
    "This document does not claim final production readiness.",
    "Scope of M20-P0",
    "M20 preview-backed field cutover",
    "Non-goals",
    "Production safety boundaries",
    "External operator blockers",
    "Operator decision dispositions",
    "EXCLUDED_FROM_CLOUDFLARE_CUTOVER",
    "Required evidence format",
    "Required rehearsal flow",
    "Backup / restore / rollback expectations",
    "Cutover authority requirements",
    "Go / No-Go checklist",
    "Rollback checklist",
    "Redacted evidence policy"
  ].join("\n"),
  "docs/operations/m20-readiness-runbook.md": [
    "# M20 Readiness Runbook",
    "M20 preview-backed field cutover",
    "Provider boundary",
    "Preconditions",
    "Field-cutover steps",
    "Field observation",
    "Operator-decision dispositions",
    "After field verification",
    "Redaction rules"
  ].join("\n"),
  "cloudflare/public-api/wrangler.toml": [
    "[env.production.vars]",
    'ENVIRONMENT = "production"',
    'ADMIN_WRITE_PREVIEW_ENABLED = "false"',
    'ADMIN_WRITE_SMOKE_ENABLED = "false"',
    "[[env.production.d1_databases]]",
    'database_id = "production-placeholder"'
  ].join("\n"),
  "src/config/publicApiProvider.ts": 'provider === "cloudflare" ? "cloudflare" : "apps-script"',
  "src/features/cms-media/api.ts":
    'export { deleteMediaAsset, saveMediaAsset, uploadMediaAsset } from "../../services/googleApi";',
  "package.json": '"worker:m20:readiness": "node cloudflare/public-api/scripts/m20-readiness-gate.mjs"',
  "cloudflare/public-api/package.json": '"m20:readiness": "node scripts/m20-readiness-gate.mjs"'
};

function createFixtureReader(overrides: Record<string, string | null> = {}) {
  const fixture = { ...repositoryFixture, ...overrides };

  return async (filePath: string) => {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const match = Object.entries(fixture)
      .sort(([left], [right]) => right.length - left.length)
      .find(([key]) => normalizedPath.endsWith(key));

    if (!match || match[1] === null) {
      throw new Error(`missing fixture for ${filePath}`);
    }

    return match[1];
  };
}

describe("M20 readiness gate", () => {
  it("reports repository alignment using mocked file reads", async () => {
    const result = await runM20ReadinessGate({ readFile: createFixtureReader() });

    expect(result.status).toBe("REPOSITORY_ALIGNED_FOR_M20_PREVIEW_FIELD_CUTOVER");
    expect(Object.values(result.checks).every((value) => value === "passed")).toBe(true);
    expect(result.futureProductionResponsibilities).toEqual(
      expect.arrayContaining([
        "final production identity and RBAC approval",
        "production-grade backup and restore policy",
        "production monitoring, alerting, and support ownership",
        "final production cutover authority"
      ])
    );
  });

  it("blocks when M19 closure evidence is missing", async () => {
    const result = await runM20ReadinessGate({
      readFile: createFixtureReader({
        "docs/architecture/m19-parity-gap-assessment-2026-06-19.md": "Status: REOPENED"
      })
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.checks.m19Closed).toBe("blocked");
  });

  it("blocks when production placeholder safety is missing", async () => {
    const result = await runM20ReadinessGate({
      readFile: createFixtureReader({
        "cloudflare/public-api/wrangler.toml": [
          "[env.production.vars]",
          'ADMIN_WRITE_PREVIEW_ENABLED = "true"',
          "[[env.production.d1_databases]]",
          'database_id = "real-production-id"'
        ].join("\n")
      })
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.checks.productionPlaceholderSafety).toBe("blocked");
  });

  it("blocks when M20 documents are missing", async () => {
    const result = await runM20ReadinessGate({
      readFile: createFixtureReader({
        "docs/architecture/m20-production-readiness-gate.md": null,
        "docs/operations/m20-readiness-runbook.md": null
      })
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.checks.m20ReadinessDocument).toBe("blocked");
    expect(result.checks.m20OperationsRunbook).toBe("blocked");
  });

  it("confirms safety flags exclude remote commands and mutations", async () => {
    const result = await runM20ReadinessGate({ readFile: createFixtureReader() });
    const output = formatM20ReadinessGate(result);

    expect(result.safety.productionCutover).toBe(false);
    expect(result.safety.d1Writes).toBe(false);
    expect(output).toContain("No remote commands were run.");
    expect(output).not.toMatch(/https?:\/\//i);
    expect(output).not.toMatch(/token|secret|database[_ -]?id/i);
  });

  it("documents field-cutover scope without claiming final production readiness", () => {
    expect(m20Doc).toMatch(/APPROVED_FOR_PREVIEW_BACKED_FIELD_VERIFICATION/i);
    expect(m20Doc).toMatch(/Production D1 \/ final production cutover/i);
    expect(m20Runbook).toMatch(/M20 Preview-Backed Field Cutover/i);
    expect(m20Runbook).toMatch(/After Field Verification/i);
    expect(currentStatus).toMatch(/Admin structured data provider: Cloudflare/i);
    expect(currentStatus).toMatch(/Public client data provider: Cloudflare/i);
    expect(currentStatus).toMatch(/preview D1 during field verification/i);
  });

  it("exposes the readiness command from root and Worker packages", () => {
    expect(rootPackage.scripts["worker:m20:readiness"]).toBe(
      "node cloudflare/public-api/scripts/m20-readiness-gate.mjs"
    );
    expect(workerPackage.scripts["m20:readiness"]).toBe("node scripts/m20-readiness-gate.mjs");
  });
});
