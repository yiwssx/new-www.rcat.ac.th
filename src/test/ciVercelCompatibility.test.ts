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

  it("uses isolated vmForks only for CI unit tests", () => {
    expect(workflow).toContain("pnpm test:unit --pool=vmForks");
    expect(workflow).toContain("pnpm test:integration");
    expect(workflow).not.toContain("pnpm test:integration --pool=vmForks");
  });

  it("delegates Vercel build suppression to the tested runtime classifier", () => {
    expect(vercelConfig.ignoreCommand).toBe("node scripts/vercel-ignore-build.mjs");
  });
});
