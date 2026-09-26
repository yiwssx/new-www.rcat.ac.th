// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "production-verification.yml"),
  "utf8"
);
const runbook = readFileSync(join(repositoryRoot, "docs", "operations", "phase-a-field-qa-foundation.md"), "utf8");
const smokeChecklist = readFileSync(join(repositoryRoot, "docs", "production-smoke-checklist.md"), "utf8");
const smokeReport = readFileSync(join(repositoryRoot, "docs", "production-smoke-test-report-template.md"), "utf8");

describe("Phase A production browser smoke deployment gate", () => {
  it("accepts expected non-runtime ignored builds and fails closed on unexpected ignored builds", () => {
    expect(workflow).toContain("fetch-depth: 2");
    expect(workflow).toContain("id: runtime_impact");
    expect(workflow).toContain("shouldIgnoreVercelBuild");
    expect(workflow).toContain("EXPECTED_IGNORED: ${{ steps.runtime_impact.outputs.expected_ignored }}");
    expect(workflow).toContain("Canceled by Ignored Build Step");
    expect(workflow).toContain('[[ "$EXPECTED_IGNORED" == "true" ]]');
    expect(workflow).toContain('echo "skip_smoke=true" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain("Vercel unexpectedly skipped a runtime-impacting change");
    expect(workflow).toContain('test -n "$target_url"');
    expect(workflow).toContain('echo "skip_smoke=false" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain("steps.vercel_gate.outputs.skip_smoke != 'true'");
  });

  it("keeps operator documentation aligned with the classified deployment gate", () => {
    for (const source of [runbook, smokeChecklist, smokeReport]) {
      expect(source).toContain("Ignored Build Step");
      expect(source).toContain("target_url");
      expect(source).toContain("non-runtime");
    }
    expect(runbook).toContain("expected ignored build");
    expect(runbook).toContain("runtime-impacting change");
  });
});
