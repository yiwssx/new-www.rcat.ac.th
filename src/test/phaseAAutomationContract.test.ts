// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = readFileSync(join(repositoryRoot, ".github", "workflows", "production-verification.yml"), "utf8");

function compact(value: string) {
  return value.replace(/\s+/g, " ");
}

describe("Phase A automation contract", () => {
  it("runs automatically only from successful master CI while retaining manual fallback", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("- CI");
    expect(workflow).toContain("workflow_dispatch:");

    const normalized = compact(workflow);
    expect(normalized).toContain("workflow_run: workflows: - CI types: - completed branches: - master");
    expect(normalized).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(normalized).toContain("github.event.workflow_run.head_branch == 'master'");
  });

  it("isolates concurrency across verification trigger sources", () => {
    const normalized = compact(workflow);
    expect(normalized).toContain("group: production-verification-");
    expect(normalized).toContain("github.event.workflow_run.head_branch");
    expect(normalized).toContain("github.event.schedule");
  });

  it("waits for the matching Vercel status and only runs browser smoke when deployment exists", () => {
    expect(workflow).toContain("Wait for matching Vercel production deployment");
    expect(workflow).toContain("github.event.workflow_run.head_sha");
    expect(workflow).toContain('status.context === "Vercel"');
    expect(workflow).toContain('case "$state" in');
    expect(workflow).toContain("failure|error)");
    expect(workflow).toContain("skip_smoke=true");
    expect(workflow).toContain("steps.vercel_gate.outputs.skip_smoke != 'true'");
    expect(workflow).toContain("pnpm exec playwright test --config playwright.production.config.ts");
  });
});
