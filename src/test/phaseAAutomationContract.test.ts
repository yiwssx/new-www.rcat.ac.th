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

function compact(value: string) {
  return value.replace(/\s+/g, " ");
}

describe("Phase A automation contract", () => {
  it("runs automatically from successful master CI while retaining manual fallback", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("- CI");
    expect(workflow).toContain("workflow_dispatch:");

    const normalized = compact(workflow);
    expect(normalized).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(normalized).toContain("github.event.workflow_run.head_branch == 'master'");
  });

  it("waits for the matching Vercel commit deployment before browser smoke", () => {
    expect(workflow).toContain("Wait for matching Vercel production deployment");
    expect(workflow).toContain("github.event.workflow_run.head_sha");
    expect(workflow).toContain('status.context === "Vercel"');
    expect(workflow).toContain('case "$state" in');
    expect(workflow).toContain("failure|error)");
    expect(workflow).toContain("pnpm exec playwright test --config playwright.production.config.ts");
  });
});
