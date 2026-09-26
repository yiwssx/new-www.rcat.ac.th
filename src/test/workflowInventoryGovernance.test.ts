// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowDir = join(process.cwd(), ".github", "workflows");
const workflowFiles = readdirSync(workflowDir)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();
const readWorkflow = (name: string) => readFileSync(join(workflowDir, name), "utf8");

const expectedWorkflows = [
  "apps-script-production-release.yml",
  "apps-script-production-rollback.yml",
  "ci.yml",
  "dependency-status-sync.yml",
  "maintenance-recovery.yml",
  "production-data-operations.yml",
  "production-verification.yml",
  "worker-production-rollback.yml",
  "worker-production.yml"
].sort();

describe("workflow inventory governance", () => {
  it("keeps the active workflow surface intentionally bounded", () => {
    expect(workflowFiles).toEqual(expectedWorkflows);
    expect(workflowFiles).toHaveLength(9);
  });

  it("does not restore retired branch-mutating, phase-specific, or duplicate workflows", () => {
    for (const retired of [
      "format-guard.yml",
      "p6b-csp-production-smoke.yml",
      "worker-production-preflight.yml",
      "apps-script-production-preflight.yml",
      "dependency-monitoring.yml",
      "p6b-production-security.yml",
      "p6c-production-reliability.yml",
      "phase-a-production-browser-smoke.yml",
      "phase-c3-authenticated-cms-field.yml",
      "production-observability.yml",
      "production-data-integrity.yml",
      "cms-link-integrity-audit.yml",
      "facebook-metadata-reclassification.yml",
      "d1-recovery-drill.yml",
      "deployment-history-maintenance.yml"
    ]) {
      expect(workflowFiles).not.toContain(retired);
    }
  });

  it("uses clear responsibility-oriented workflow names", () => {
    expect(readWorkflow("ci.yml")).toContain("name: CI");
    expect(readWorkflow("dependency-status-sync.yml")).toContain("name: Dependencies");
    expect(readWorkflow("production-verification.yml")).toContain("name: Production Verification");
    expect(readWorkflow("production-data-operations.yml")).toContain("name: Production Data Operations");
    expect(readWorkflow("maintenance-recovery.yml")).toContain("name: Maintenance & Recovery");
    expect(readWorkflow("worker-production.yml")).toContain("name: Deploy / Worker");
    expect(readWorkflow("apps-script-production-release.yml")).toContain("name: Deploy / Apps Script");
  });
});
