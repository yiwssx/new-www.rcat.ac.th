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
  "cms-link-integrity-audit.yml",
  "d1-recovery-drill.yml",
  "dependency-monitoring.yml",
  "dependency-status-sync.yml",
  "deployment-history-maintenance.yml",
  "facebook-metadata-reclassification.yml",
  "p6b-production-security.yml",
  "p6c-production-reliability.yml",
  "phase-a-production-browser-smoke.yml",
  "phase-c3-authenticated-cms-field.yml",
  "production-data-integrity.yml",
  "production-observability.yml",
  "worker-production-rollback.yml",
  "worker-production.yml"
].sort();

describe("workflow inventory governance", () => {
  it("keeps the active workflow surface intentionally bounded", () => {
    expect(workflowFiles).toEqual(expectedWorkflows);
    expect(workflowFiles).toHaveLength(17);
  });

  it("does not restore retired branch-mutating or duplicate preflight workflows", () => {
    for (const retired of [
      "format-guard.yml",
      "p6b-csp-production-smoke.yml",
      "worker-production-preflight.yml",
      "apps-script-production-preflight.yml"
    ]) {
      expect(workflowFiles).not.toContain(retired);
    }
  });

  it("uses clear consolidated names for high-frequency operator surfaces", () => {
    expect(readWorkflow("ci.yml")).toContain("name: CI");
    expect(readWorkflow("dependency-status-sync.yml")).toContain("name: Dependencies / Snapshot Repair");
    expect(readWorkflow("p6b-production-security.yml")).toContain("name: Production / Security");
    expect(readWorkflow("worker-production.yml")).toContain("name: Deploy / Worker");
    expect(readWorkflow("apps-script-production-release.yml")).toContain("name: Deploy / Apps Script");
  });
});
