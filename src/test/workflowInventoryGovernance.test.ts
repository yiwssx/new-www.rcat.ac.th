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
  "image-production-worker.yml",
  "maintenance-recovery.yml",
  "production-data-operations.yml",
  "production-verification.yml",
  "security-audit-preflight.yml",
  "ubuntu26-compatibility-canary.yml",
  "worker-production-rollback.yml",
  "worker-production.yml"
].sort();

describe("workflow inventory governance", () => {
  it("keeps the active workflow surface intentionally bounded", () => {
    expect(workflowFiles).toEqual(expectedWorkflows);
    expect(workflowFiles).toHaveLength(12);
  });

  it("does not restore retired branch-mutating, phase-specific, or duplicate workflows", () => {
    for (const retired of [
      "format-guard.yml",
      "pr-prettier-autofix.yml",
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

  it("keeps all routine and protected jobs on the moving ubuntu-latest label", () => {
    for (const name of workflowFiles.filter((file) => file !== "ubuntu26-compatibility-canary.yml")) {
      const labels = [...readWorkflow(name).matchAll(/^\s*runs-on:\s*([^\s#]+)/gm)].map((match) => match[1]);
      expect(labels.length, name).toBeGreaterThan(0);
      expect(labels, name).toEqual(Array.from({ length: labels.length }, () => "ubuntu-latest"));
    }
  });

  it("keeps the Ubuntu 26 canary unprivileged and isolated from production", () => {
    // ASVS 15.2.5: keep compatibility execution isolated from production authority.
    const canary = readWorkflow("ubuntu26-compatibility-canary.yml");
    expect(canary).toContain("permissions:\n  contents: read");
    expect(canary).toContain("workflow_dispatch:");
    expect(canary).toContain('      - ".github/workflows/ubuntu26-compatibility-canary.yml"');
    expect(canary.match(/runs-on: ubuntu-26\.04/g)).toHaveLength(3);
    expect(canary.match(/persist-credentials: false/g)).toHaveLength(3);
    expect(canary).not.toMatch(/\b(?:schedule|push|pull_request_target|workflow_run|environment|secrets)\s*:/);
    expect(canary).not.toContain("secrets.");
    expect(canary).not.toContain("continue-on-error:");
    expect(canary).not.toContain("workflow_dispatch --");
    expect(canary).not.toMatch(/wrangler\s+(?:deploy|d1)|clasp\s+(?:push|deploy)|vercel\s+--prod/);
    expect(canary).toContain("pnpm worker:deploy:dry");
    expect(canary).toContain("bash scripts/security-audit/run-preflight.sh standard");
  });

  it("uses clear responsibility-oriented workflow names", () => {
    expect(readWorkflow("ci.yml")).toContain("name: CI");
    expect(readWorkflow("dependency-status-sync.yml")).toContain("name: Dependency Monitor");
    expect(readWorkflow("image-production-worker.yml")).toContain("name: Deploy / Image Production Worker");
    expect(readWorkflow("production-verification.yml")).toContain("name: Production Verification");
    expect(readWorkflow("production-data-operations.yml")).toContain("name: Production Data Operations");
    expect(readWorkflow("maintenance-recovery.yml")).toContain("name: Maintenance & Recovery");
    const auditPreflight = readWorkflow("security-audit-preflight.yml");
    expect(auditPreflight).toContain("name: Security Audit Preflight");
    expect(auditPreflight).toContain("workflow_dispatch:");
    expect(auditPreflight).toContain("permissions:\n  contents: read");
    expect(auditPreflight).not.toContain("pull_request:");
    expect(auditPreflight).not.toContain("  push:");
    expect(readWorkflow("worker-production.yml")).toContain("name: Deploy / Worker");
    expect(readWorkflow("apps-script-production-release.yml")).toContain("name: Deploy / Apps Script");
  });
});
