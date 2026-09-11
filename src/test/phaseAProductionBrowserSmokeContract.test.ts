// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "phase-a-production-browser-smoke.yml"),
  "utf8"
);
const runbook = readFileSync(join(repositoryRoot, "docs", "operations", "phase-a-field-qa-foundation.md"), "utf8");
const smokeChecklist = readFileSync(join(repositoryRoot, "docs", "production-smoke-checklist.md"), "utf8");
const smokeReport = readFileSync(join(repositoryRoot, "docs", "production-smoke-test-report-template.md"), "utf8");

describe("Phase A production browser smoke deployment gate", () => {
  it("fails closed when Vercel skipped deployment creation", () => {
    expect(workflow).toContain('description: vercel?.description || ""');
    expect(workflow).toContain('targetUrl: vercel?.target_url || ""');
    expect(workflow).toContain('Canceled by Ignored Build Step');
    expect(workflow).toContain('[[ "$description" == *"Ignored Build Step"* ]]');
    expect(workflow).toContain('[[ -z "$target_url" ]]');
    expect(workflow).not.toContain('process.stdout.write(vercel?.state || "missing");');
  });

  it("keeps operator documentation aligned with the fail-closed gate", () => {
    for (const source of [runbook, smokeChecklist, smokeReport]) {
      expect(source).toContain("Ignored Build Step");
      expect(source).toContain("target_url");
    }
    expect(runbook).toContain("Phase A now fails closed");
    expect(runbook).toContain("Only a non-ignored successful status with a deployment target URL is accepted");
  });
});
