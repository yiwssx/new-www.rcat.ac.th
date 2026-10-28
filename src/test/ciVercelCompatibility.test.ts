// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = readFileSync(join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");
const vercelConfig = JSON.parse(readFileSync(join(repositoryRoot, "vercel.json"), "utf8")) as {
  ignoreCommand?: string;
};
const requiredLanes = [
  "dependencies",
  "static-quality",
  "unit",
  "integration",
  "build",
  "governance",
  "worker",
  "functional"
] as const;

describe("CI Vercel compatibility", () => {
  it("keeps the historical quality check as an aggregate of all parallel lanes", () => {
    const qualityStart = workflow.indexOf("\n  quality:\n");

    expect(qualityStart).toBeGreaterThan(-1);

    const qualityJob = workflow.slice(qualityStart);
    expect(qualityJob).toContain("if: ${{ always() }}");
    expect(qualityJob).toContain("Verify planned CI lanes and justified skips");
    expect(qualityJob).toContain("run: node scripts/ci/quality-gate.mjs");
    expect(workflow).toContain("run: node scripts/ci/detect-impact.mjs");

    for (const lane of requiredLanes) {
      expect(qualityJob, lane).toContain(`      - ${lane}`);
      expect(qualityJob, lane).toContain(`needs.${lane}.result`);
    }
  });

  it("runs impact detection and dependency preflight independently while keeping every lane gated", () => {
    const preflight = workflow.split("\n  dependency-preflight:\n")[1]?.split("\n  dependencies:\n")[0];
    const quality = workflow.split("\n  quality:\n")[1];

    expect(preflight).toBeDefined();
    expect(preflight).not.toContain("needs: impact");
    expect(workflow.match(/needs: \[impact, dependency-preflight\]/gmu)?.length).toBe(8);
    expect(quality).toContain("CI_IMPACT_STATUS: ${{ needs.impact.result }}");
    expect(quality).toContain("CI_PREFLIGHT_STATUS: ${{ needs.dependency-preflight.result }}");
  });

  it("keeps full static checks for code while allowing verified docs-only formatting", () => {
    expect(workflow).toContain("      - run: pnpm format:check");
    expect(workflow).toContain("run: node scripts/ci/run-affected-static.mjs");
    expect(workflow).toContain("CI_PLAN: ${{ needs.impact.outputs.plan }}");
    expect(workflow).toContain("      - static-quality");
    expect(workflow).toContain("needs.static-quality.result");
  });

  it("scopes changed unit-test files without skipping critical coverage checks", () => {
    expect(workflow).toContain("run: node scripts/ci/run-affected-unit.mjs");
    expect(workflow).not.toContain("--pool=vmForks");
    expect(workflow).toContain("CI_PLAN: ${{ needs.impact.outputs.plan }}");
    expect(workflow).toContain("Enforce critical coverage thresholds");
    expect(workflow).toContain("run: pnpm test:integration");
  });

  it("keeps browser setup and full fallback when adding test-only Playwright selection", () => {
    expect(workflow).toContain("run: node scripts/ci/run-affected-functional.mjs");
    expect(workflow).toContain("playwright install --with-deps chromium");
    expect(workflow).toContain("playwright.production.config.ts --list");
    expect(workflow).toContain("needs.impact.outputs.plan");
  });

  it("delegates Vercel build suppression to the tested runtime classifier", () => {
    expect(vercelConfig.ignoreCommand).toBe("node scripts/vercel-ignore-build.mjs");
  });
});
