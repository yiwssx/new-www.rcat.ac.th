// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const productionConfig = readFileSync(join(repositoryRoot, "playwright.production.config.ts"), "utf8");
const phaseC3Config = readFileSync(join(repositoryRoot, "playwright.phase-c3.config.ts"), "utf8");
const phaseAWorkflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "phase-a-production-browser-smoke.yml"),
  "utf8"
);
const phaseC3Workflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "phase-c3-authenticated-cms-field.yml"),
  "utf8"
);
const accessibilitySpec = readFileSync(
  join(repositoryRoot, "tests", "production", "production.accessibility.pw.ts"),
  "utf8"
);
const performanceSpec = readFileSync(
  join(repositoryRoot, "tests", "production", "production.performance.pw.ts"),
  "utf8"
);
const phaseC3Spec = readFileSync(join(repositoryRoot, "tests", "field-authenticated", "phase-c3.cms.pw.ts"), "utf8");
const phaseC3Fixture = readFileSync(join(repositoryRoot, "scripts", "phase-c3-disposable-fixture.mjs"), "utf8");
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

  it("C2 stays bounded inside the read-only production browser guard", () => {
    expect(performanceSpec).toContain("Phase C2 synthetic performance regression");
    expect(performanceSpec).toContain("timeToFirstByte: 5_000");
    expect(performanceSpec).toContain("firstContentfulPaint: 7_000");
    expect(productionConfig).toContain("workers: 1");
  });

  it("C3 is isolated from automatic read-only field QA and requires protected manual execution", () => {
    expect(phaseC3Config).toContain('testDir: "./tests/field-authenticated"');
    expect(phaseC3Config).toContain("workers: 1");
    expect(phaseC3Config).toContain("retries: 0");
    expect(phaseC3Config).toContain('trace: "off"');
    expect(phaseAWorkflow).not.toContain("playwright.phase-c3.config.ts");
    expect(phaseC3Workflow).toContain("workflow_dispatch:");
    expect(phaseC3Workflow).toContain("environment: production");
    expect(phaseC3Workflow).toContain("if: ${{ always() }}");
    expect(phaseC3Workflow).toContain("Verify deterministic cleanup");
  });

  it("C3 provisions only a run-scoped non-root editor and never depends on normal Admin credentials", () => {
    expect(phaseC3Fixture).toContain("'editor', 'active'");
    expect(phaseC3Fixture).toContain("username, is_root, must_change_password, mfa_required");
    expect(phaseC3Fixture).toContain("0, 0, 0, 1");
    expect(phaseC3Fixture).toContain("GITHUB_RUN_ID");
    expect(phaseC3Workflow).toContain("CLOUDFLARE_API_TOKEN");
    expect(phaseC3Workflow).not.toMatch(/CMS_(?:ADMIN|ROOT)_(?:USERNAME|PASSWORD)/);
  });

  it("C3 proves Facebook thumbnail fallback, public visibility, deletion, and cleanup", () => {
    expect(phaseC3Spec).toContain("บันทึกเนื้อหาสำเร็จ แต่ยังไม่มี Thumbnail");
    expect(phaseC3Spec).toContain("เผยแพร่เนื้อหาสำเร็จ");
    expect(phaseC3Spec).toContain("/api/public/content/");
    expect(phaseC3Spec).toContain("ลบเนื้อหาสำเร็จ");
    expect(phaseC3Fixture).toContain("DELETE FROM contents WHERE slug");
    expect(phaseC3Fixture).toContain("DELETE FROM app_admin_users");
  });

  it("Phase C does not add a paid or duplicate browser-testing stack", () => {
    const installed = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };

    for (const packageName of paidOrExternalBrowserStacks) {
      expect(installed).not.toHaveProperty(packageName);
    }
  });
});
