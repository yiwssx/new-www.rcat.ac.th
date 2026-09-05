import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Phase C2 production performance guard", () => {
  it("reuses the existing read-only production Playwright pipeline", () => {
    const workflow = readFileSync(".github/workflows/phase-a-production-browser-smoke.yml", "utf8");
    const config = readFileSync("playwright.production.config.ts", "utf8");

    expect(workflow).toContain("pnpm exec playwright test --config playwright.production.config.ts");
    expect(workflow).toContain("Production writes: none");
    expect(config).toMatch(/fullyParallel:\s*false/);
    expect(config).toMatch(/workers:\s*1/);
  });

  it("keeps fixed gross-regression ceilings in repository-owned test code", () => {
    const source = readFileSync("tests/production/production.performance.pw.ts", "utf8");

    expect(source).toContain("timeToFirstByte: 5_000");
    expect(source).toContain("firstContentfulPaint: 7_000");
    expect(source).toContain("domContentLoaded: 10_000");
    expect(source).toContain("load: 12_000");
    expect(source).toContain('page.goto("/", { waitUntil: "load" })');
  });

  it("does not require an additional performance service", () => {
    const packageJson = readFileSync("package.json", "utf8");

    expect(packageJson).not.toMatch(/\b(?:lighthouse|sitespeed\.io|browserstack|datadog|newrelic|sentry)\b/i);
  });
});
