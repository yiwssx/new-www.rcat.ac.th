// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const productionConfig = readFileSync(join(repositoryRoot, "playwright.production.config.ts"), "utf8");
const phaseAWorkflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "phase-a-production-browser-smoke.yml"),
  "utf8"
);
const accessibilitySpec = readFileSync(
  join(repositoryRoot, "tests", "production", "production.accessibility.pw.ts"),
  "utf8"
);
const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const paidOrExternalBrowserStacks = ["@browserstack/playwright", "sentry", "datadog", "newrelic"];

describe("Phase C deep field verification contract", () => {
  it("C1 reuses the deployment-driven production Playwright guard", () => {
    expect(productionConfig).toContain('testDir: "./tests/production"');
    expect(productionConfig).toContain('testMatch: "**/*.pw.ts"');
    expect(phaseAWorkflow).toContain("pnpm exec playwright test --config playwright.production.config.ts");
    expect(accessibilitySpec).toContain("Phase C1 automated accessibility");
    expect(accessibilitySpec).toContain("admin-auth-boundary");
  });

  it("C1 does not add a paid or duplicate browser-testing stack", () => {
    const installed = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };

    for (const packageName of paidOrExternalBrowserStacks) {
      expect(installed).not.toHaveProperty(packageName);
    }
  });
});
