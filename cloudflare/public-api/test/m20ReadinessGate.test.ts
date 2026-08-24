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
    "M20: `CLOSED` for migration/runtime/domain-cutover scope.",
    "M21: `SUPERSEDED` historical UI/UX and logic stabilization snapshot.",
    "Admin structured data provider: Cloudflare.",
    "Public client data provider: Cloudflare.",
    "Media/attachment/file provider: Google Drive via Apps Script bridge.",
    "Database provider: D1.",
    "Production custom domain: `www.rcat.ac.th` connected to Vercel production."
  ].join("\n"),
  "docs/architecture/m19-parity-gap-assessment-2026-06-19.md":
    "Status: CLOSED for repository-owned M19 parity remediation.",
  "docs/architecture/m20-production-readiness-gate.md": [
    "# M20 Production Readiness Gate",
    "Current state after M19",
    "M19 is closed.",
    "M20 is closed for migration/runtime ownership. Post-M20 UI/UX and logic stabilization was tracked separately and is now superseded by the post-P5H baseline.",
    "CLOSED_FOR_MIGRATION_RUNTIME_DOMAIN_SCOPE.",
    "M20 closure does not mean the UI/UX is complete, the system is defect-free.",
    "Scope of M20-P0",
    "M20 closure note",
    "The Cloudflare/Vercel redirect loop was resolved.",
    "No D1 migration blocker remains.",
    "No Apps Script structured-data blocker remains.",
    "No runtime ownership blocker remains.",
    "Non-goals",
    "Production safety boundaries",
    "External operator blockers",
    "Operator decision dispositions",
    "EXCLUDED_FROM_CLOUDFLARE_CUTOVER",
    "Required evidence format",
    "Required verification flow",
    "Backup / restore / rollback expectations",
    "Cutover authority requirements",
    "Go / No-Go checklist",
    "Rollback checklist",
    "Redacted evidence policy"
  ].join("\n"),
  "docs/operations/m20-readiness-runbook.md": [
    "# M20 Readiness Runbook",
    "M20 closure runbook",
    "Provider boundary",
    "Preconditions",
    "Closure steps",
    "Post-closure observation",
    "Operator-decision dispositions",
    "After M20 closure",
    "Redaction rules"
  ].join("\n"),
  "cloudflare/public-api/wrangler.toml": [
    "[env.production.vars]",
    'ENVIRONMENT = "production"',
    "[[env.production.d1_databases]]",
    'database_id = "production-placeholder"'
  ].join("\n"),
  "src/config/publicApiProvider.ts": 'provider === "cloudflare" ? "cloudflare" : "apps-script"',
  "src/features/cms-media/api.ts":
    'import { deleteMediaAssetFromBridge, saveMediaAssetToBridge, uploadMediaAssetToBridge } from "./mediaBridgeClient";',
  "src/features/cms-media/mediaBridgeClient.ts": 'const mediaBridgePath = "/api/apps-script-proxy";',
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

    expect(result.status).toBe("REPOSITORY_ALIGNED_FOR_M20_MIGRATION_RUNTIME_DOMAIN_CLOSURE");
    expect(Object.values(result.checks).every((value) => value === "passed")).toBe(true);
    expect(result.futureProductionResponsibilities).toEqual(
      expect.arrayContaining([
        "final production identity and RBAC approval",
        "production-grade backup and restore policy",
        "production monitoring, alerting, and support ownership",
        "post-M20 UI/UX and logic stabilization evidence, superseded by the post-P5H baseline"
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
          'ENVIRONMENT = "production"',
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

  it("documents M20 closure scope without claiming UI/UX completion", () => {
    expect(m20Doc).toMatch(/CLOSED_FOR_MIGRATION_RUNTIME_DOMAIN_SCOPE/i);
    expect(m20Doc).toMatch(/No D1 migration blocker remains/i);
    expect(m20Runbook).toMatch(/M20 Closure Runbook/i);
    expect(m20Runbook).toMatch(/After M20 Closure/i);
    expect(currentStatus).toMatch(/Admin structured data provider: Cloudflare/i);
    expect(currentStatus).toMatch(/Public client data provider: Cloudflare/i);
    expect(currentStatus).toMatch(/Database provider: D1/i);
    expect(currentStatus).toMatch(/M21-era stabilization scope was replaced by the post-P5H production governance baseline/i);
  });

  it("exposes the readiness command from root and Worker packages", () => {
    expect(rootPackage.scripts["worker:m20:readiness"]).toBe(
      "node cloudflare/public-api/scripts/m20-readiness-gate.mjs"
    );
    expect(workerPackage.scripts["m20:readiness"]).toBe("node scripts/m20-readiness-gate.mjs");
  });
});
