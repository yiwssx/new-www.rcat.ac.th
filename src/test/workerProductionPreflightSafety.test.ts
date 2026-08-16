import { describe, expect, it } from "vitest";
import preflightWorkflow from "../../.github/workflows/worker-production-preflight.yml?raw";
import releaseWorkflow from "../../.github/workflows/worker-production.yml?raw";
import preflightSource from "../../cloudflare/public-api/scripts/worker-production-preflight.mjs?raw";

describe("P5 Worker production preflight safety", () => {
  it("keeps the standalone preflight master-only, protected, and read-only", () => {
    expect(preflightWorkflow).toContain("github.ref == 'refs/heads/master'");
    expect(preflightWorkflow).toMatch(/environment:\s*production/);
    expect(preflightWorkflow).toContain("worker-production-preflight.mjs");
    expect(preflightWorkflow).toContain("PRODUCTION_D1_RESOURCE_NAME: rcat-public-api-preview");
    expect(preflightWorkflow).toContain('d1 time-travel info "$PRODUCTION_D1_RESOURCE_NAME"');
    expect(preflightWorkflow).toContain("List unapplied production migrations");
    expect(preflightWorkflow).not.toMatch(/d1\s+migrations\s+apply/i);
    expect(preflightWorkflow).not.toMatch(/wrangler\s+deploy/i);
    expect(preflightWorkflow).not.toMatch(/d1\s+time-travel\s+restore/i);
    expect(preflightWorkflow).not.toMatch(/d1\s+execute[^\n]*--file/i);
  });

  it("uses the same protected production D1 identity for preflight and release", () => {
    for (const workflow of [preflightWorkflow, releaseWorkflow]) {
      expect(workflow).toContain("RCAT_PRODUCTION_D1_DATABASE_ID");
      expect(workflow).toContain("Resolve exact production D1 identity");
      expect(workflow).toContain("--verify-identity-only");
    }

    expect(preflightSource).toContain("assertProductionDatabaseIdentity");
    expect(preflightSource).toContain("createProductionWranglerConfig");
    expect(preflightSource).toContain("--experimental-provision=false");
    expect(preflightSource).toContain("--experimental-auto-create=false");
  });

  it("requires a fresh Time Travel bookmark and migration listing before the mutating release step", () => {
    const bookmark = releaseWorkflow.indexOf("Capture pre-release Time Travel bookmark");
    const migrationList = releaseWorkflow.indexOf("List unapplied production migrations before release");
    const deploy = releaseWorkflow.indexOf("Apply pending migrations and deploy production Worker");

    expect(bookmark).toBeGreaterThan(-1);
    expect(migrationList).toBeGreaterThan(bookmark);
    expect(deploy).toBeGreaterThan(migrationList);
    expect(releaseWorkflow).not.toMatch(/d1\s+time-travel\s+restore/i);
  });
});
