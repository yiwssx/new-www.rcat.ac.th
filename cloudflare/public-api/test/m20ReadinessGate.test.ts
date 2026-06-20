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
    "M20: `BLOCKED` and not started.",
    "M20-P0 readiness gate scaffolding is added.",
    "M20 production execution remains BLOCKED.",
    "Apps Script remains the fallback and rollback provider.",
    "No production mutation occurred.",
    "No cutover readiness is claimed."
  ].join("\n"),
  "docs/architecture/m19-parity-gap-assessment-2026-06-19.md": [
    "Status: CLOSED for repository-owned M19 parity remediation.",
    "M20 is not started.",
    "External operator blockers remain."
  ].join("\n"),
  "docs/architecture/m20-production-readiness-gate.md": [
    "# M20 Production Readiness Gate",
    "Current state after M19",
    "M19 is closed.",
    "M20 remains BLOCKED until external operator gates pass.",
    "Scope of M20-P0",
    "Non-goals",
    "Production safety boundaries",
    "External operator blockers",
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
    "Post-M19 public-read preview smoke",
    "Preview-only migration verification",
    "Admin write preview smoke",
    "Full structured data inventory",
    "Cross-provider reconciliation",
    "Media bridge verification",
    "Identity/RBAC approval",
    "Backup rehearsal",
    "Restore rehearsal",
    "Rollback rehearsal",
    "Monitoring and alert threshold approval",
    "Final cutover approval"
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
  it("reports repository-ready using mocked file reads", async () => {
    const result = await runM20ReadinessGate({ readFile: createFixtureReader() });

    expect(result.status).toBe("REPOSITORY_READY_FOR_M20_REVIEW");
    expect(Object.values(result.checks).every((value) => value === "passed")).toBe(true);
    expect(result.externalOperatorBlockers).toEqual(
      expect.arrayContaining([
        "post-M19 public-read preview smoke evidence",
        "production identity and RBAC approval",
        "sanitized full structured data inventory and reconciliation",
        "backup, restore, rollback, monitoring, and final cutover authority"
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
    expect(result.validationIssues).toContain("m19Closed: M19 closure evidence is missing");
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

    expect(result.safety).toEqual({
      remoteCommandsRun: false,
      networkRequests: false,
      d1Writes: false,
      workerDeploy: false,
      vercelMutation: false,
      appsScriptMutation: false,
      googleDriveMutation: false,
      productionCutover: false
    });
    expect(output).toContain("No remote commands were run.");
    expect(output).not.toMatch(/https?:\/\//i);
    expect(output).not.toMatch(/token|secret|database[_ -]?id/i);
  });

  it("documents M20-P0 without reopening M19 or starting production execution", () => {
    expect(m20Doc).toMatch(/M19 is closed/i);
    expect(m20Doc).toMatch(/M20 remains BLOCKED/i);
    expect(m20Doc).toMatch(/Redacted evidence policy/i);
    expect(m20Runbook).toMatch(/Post-M19 public-read preview smoke/i);
    expect(m20Runbook).toMatch(/Final cutover approval/i);
    expect(currentStatus).toMatch(/M20-P0 readiness gate scaffolding is added/i);
    expect(currentStatus).toMatch(/M20 production execution remains BLOCKED/i);
  });

  it("exposes the readiness command from root and Worker packages", () => {
    expect(rootPackage.scripts["worker:m20:readiness"]).toBe(
      "node cloudflare/public-api/scripts/m20-readiness-gate.mjs"
    );
    expect(workerPackage.scripts["m20:readiness"]).toBe("node scripts/m20-readiness-gate.mjs");
  });
});
