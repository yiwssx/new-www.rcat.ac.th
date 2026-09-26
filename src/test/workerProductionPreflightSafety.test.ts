import { describe, expect, it } from "vitest";
import workflow from "../../.github/workflows/worker-production.yml?raw";
import preflightSource from "../../cloudflare/public-api/scripts/worker-production-preflight.mjs?raw";

const preflightStart = workflow.indexOf("\n  preflight:");
const releaseStart = workflow.indexOf("\n  release:");
const preflightWorkflow = workflow.slice(preflightStart, releaseStart);
const releaseWorkflow = workflow.slice(releaseStart);

describe("Worker production workflow safety", () => {
  it("keeps read-only preflight and mutating release as explicit operations", () => {
    expect(workflow).toContain("name: Deploy / Worker");
    expect(workflow).toContain("- preflight");
    expect(workflow).toContain("- release");
    expect(preflightStart).toBeGreaterThan(-1);
    expect(releaseStart).toBeGreaterThan(preflightStart);
  });

  it("keeps the preflight protected and read-only", () => {
    expect(preflightWorkflow).toContain("name: production");
    expect(preflightWorkflow).toContain("deployment: false");
    expect(preflightWorkflow).toContain("secrets.CLOUDFLARE_D1_READ_TOKEN");
    expect(preflightWorkflow).not.toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(preflightWorkflow).toContain("worker-production-preflight.mjs");
    expect(preflightWorkflow).toContain('d1 time-travel info "$PRODUCTION_D1_RESOURCE_NAME"');
    expect(preflightWorkflow).toContain("List unapplied production migrations");
    expect(preflightWorkflow).not.toMatch(/d1\s+migrations\s+apply/i);
    expect(preflightWorkflow).not.toMatch(/wrangler\s+deploy/i);
    expect(preflightWorkflow).not.toMatch(/d1\s+time-travel\s+restore/i);
    expect(preflightWorkflow).not.toMatch(/d1\s+execute[^\n]*--file/i);
  });

  it("uses the same protected production D1 identity in both operations", () => {
    for (const section of [preflightWorkflow, releaseWorkflow]) {
      expect(section).toContain("RCAT_PRODUCTION_D1_DATABASE_ID");
      expect(section).toContain("Resolve exact production D1 identity");
      expect(section).toContain("--verify-identity-only");
    }
    expect(preflightSource).toContain("assertProductionDatabaseIdentity");
    expect(preflightSource).toContain("createProductionWranglerConfig");
  });

  it("requires Time Travel and migration listing before the release mutation", () => {
    const bookmark = releaseWorkflow.indexOf("Capture pre-release Time Travel bookmark");
    const migrationList = releaseWorkflow.indexOf("List unapplied production migrations before release");
    const deploy = releaseWorkflow.indexOf("Apply pending migrations and deploy production Worker");

    expect(releaseWorkflow).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(releaseWorkflow).not.toContain("secrets.CLOUDFLARE_D1_READ_TOKEN");
    expect(releaseWorkflow).toContain("group: worker-production-write");
    expect(bookmark).toBeGreaterThan(-1);
    expect(migrationList).toBeGreaterThan(bookmark);
    expect(deploy).toBeGreaterThan(migrationList);
    expect(releaseWorkflow).not.toMatch(/d1\s+time-travel\s+restore/i);
  });
});
