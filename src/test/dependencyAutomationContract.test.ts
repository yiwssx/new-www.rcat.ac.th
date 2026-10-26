// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");
const renovate = JSON.parse(read("renovate.json")) as Record<string, unknown>;
const dependenciesWorkflow = read(".github/workflows/dependency-status-sync.yml");
const ciWorkflow = read(".github/workflows/ci.yml");
const qualityBridgeScript = read("scripts/validate-required-quality.sh");
const dependencyStatusScript = read("scripts/generate-dependency-status.mjs");
const dependencyCheckScript = read("scripts/check-dependencies.mjs");
const packageJson = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
const pnpmWorkspace = read("pnpm-workspace.yaml");
const muiFocusTrapPatch = read("patches/@mui__material@9.4.0.patch");

describe("dependency automation contract", () => {
  it("bounds normal Renovate churn to the Bangkok maintenance window", () => {
    expect(renovate.dependencyDashboard).toBe(true);
    expect(renovate.timezone).toBe("Asia/Bangkok");
    expect(renovate.schedule).toEqual(["* 0-6 * * *"]);
    expect(renovate.updateNotScheduled).toBe(false);
    expect(renovate.automergeSchedule).toEqual(["* 0-6 * * *"]);
    expect(renovate.prConcurrentLimit).toBe(3);
    expect(renovate.branchConcurrentLimit).toBe(3);
    expect(renovate.prHourlyLimit).toBe(2);
    expect(renovate.commitHourlyLimit).toBe(4);
    expect(renovate.rebaseWhen).toBe("behind-base-branch");
    expect(renovate.platformAutomerge).toBe(false);
    expect(renovate.automergeStrategy).toBe("squash");
  });

  it("aligns Renovate and pnpm on the same three-day release-age policy", () => {
    expect(renovate.extends).toEqual(expect.arrayContaining(["security:minimumReleaseAgeNpm"]));
    expect(renovate).not.toHaveProperty("minimumReleaseAgeBuffer");
    expect(renovate.rangeStrategy).toBe("update-lockfile");
    expect(pnpmWorkspace).toContain("minimumReleaseAge: 4320");
    expect(pnpmWorkspace).not.toContain("minimumReleaseAgeExclude:");
  });

  it("keeps coherent functional grouping and manual review boundaries", () => {
    const packageRules = renovate.packageRules as Array<Record<string, unknown>>;
    expect(packageRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ matchUpdateTypes: ["major"], automerge: false }),
        expect.objectContaining({
          matchManagers: ["npm"],
          matchDepTypes: ["dependencies"],
          matchCurrentVersion: "!/^0/",
          matchUpdateTypes: ["patch", "minor"],
          groupName: "other runtime dependencies"
        }),
        expect.objectContaining({
          matchManagers: ["npm"],
          matchDepTypes: ["devDependencies"],
          matchDepNames: ["!typescript", "!@typescript/native", "!@types/node", "!jsdom"],
          matchCurrentVersion: "!/^0/",
          matchUpdateTypes: ["patch", "minor"],
          groupName: "other development dependencies"
        }),
        expect.objectContaining({
          matchPackageNames: ["react-hook-form", "@hookform/resolvers", "zod"],
          groupName: "form validation"
        }),
        expect.objectContaining({
          matchPackageNames: ["@playwright/test", "@axe-core/playwright"],
          groupName: "browser testing"
        }),
        expect.objectContaining({
          matchPackageNames: ["@types/node"],
          rangeStrategy: "bump",
          allowedVersions: ">=24.0.0 <25.0.0"
        }),
        expect.objectContaining({
          matchPackageNames: ["react", "react-dom"],
          groupName: "react runtime"
        }),
        expect.objectContaining({
          matchPackageNames: ["vitest", "@vitest/coverage-v8"],
          groupName: "vitest toolchain"
        }),
        expect.objectContaining({
          matchPackageNames: ["@dnd-kit/react", "@dnd-kit/helpers"],
          groupName: "dnd-kit"
        }),
        expect.objectContaining({
          matchPackageNames: ["wrangler", "@cloudflare/workers-types"],
          groupName: "cloudflare toolchain"
        }),
        expect.objectContaining({
          matchPackageNames: ["@tanstack/react-query", "@tanstack/react-router", "@tanstack/react-table"],
          groupName: "tanstack runtime"
        }),
        expect.objectContaining({
          matchPackageNames: ["vite", "@vitejs/plugin-react", "vite-plugin-checker"],
          groupName: "vite build tooling"
        }),
        expect.objectContaining({
          matchPackageNames: ["prettier", "eslint-config-prettier", "lint-staged"],
          groupName: "formatting tooling"
        }),
        expect.objectContaining({ matchManagers: ["github-actions"], groupName: "github actions" })
      ])
    );
  });

  it("keeps the pnpm 10 Renovate rule schema-valid and manual-review only", () => {
    const rules = renovate.packageRules as Array<Record<string, unknown>>;
    for (const rule of rules) {
      if (rule.matchUpdateTypes !== undefined) {
        // Renovate rejects either matcher combination and disables all updates.
        expect(rule).not.toHaveProperty("allowedVersions");
        expect(rule).not.toHaveProperty("rangeStrategy");
      }
    }

    const pnpmRule = rules.find(
      (rule) =>
        Array.isArray(rule.matchDepTypes) &&
        rule.matchDepTypes.includes("packageManager") &&
        Array.isArray(rule.matchPackageNames) &&
        rule.matchPackageNames.includes("pnpm")
    );
    expect(pnpmRule).toEqual(
      expect.objectContaining({
        allowedVersions: ">=10.0.0 <11.0.0",
        enabled: true,
        automerge: false,
        addLabels: ["manual-review", "toolchain"]
      })
    );
    expect(pnpmRule).not.toHaveProperty("matchUpdateTypes");
    expect(pnpmRule).not.toHaveProperty("rangeStrategy");
  });

  it("keeps retired JWT libraries out of direct runtime dependencies", () => {
    expect(packageJson.dependencies).not.toHaveProperty("jose");
    expect(packageJson.dependencies).not.toHaveProperty("jwt-decode");
  });

  it("keeps the jsdom 30.1 MUI focus-restoration compatibility patch narrow", () => {
    expect(pnpmWorkspace).toContain('"@mui/material@>=9.4.0 <9.6.0": patches/@mui__material@9.4.0.patch');
    expect(muiFocusTrapPatch).toContain('typeof nodeToRestore.current?.focus === "function"');
    expect(muiFocusTrapPatch.match(/^diff --git /gmu)).toHaveLength(2);
  });

  it("treats compatibility policy selected versions as same-major anchors", () => {
    expect(dependencyStatusScript).toContain("const policySelected = parseVersion(exception?.selected);");
    expect(dependencyStatusScript).toContain("const selected = installedVersion;");
    expect(dependencyCheckScript).toContain("const selected = parseVersion(installedPackage?.version);");
  });

  it("validates Cloudflare lockfile updates against declared semver ranges", () => {
    expect(dependencyCheckScript).toContain('const wranglerSpecifier = directSpecifier("wrangler");');
    expect(dependencyCheckScript).toContain(
      'const workersTypesSpecifier = directSpecifier("@cloudflare/workers-types");'
    );
    expect(dependencyCheckScript).toContain("satisfiesRange(wranglerInstalledVersion, wranglerSpecifier)");
    expect(dependencyCheckScript).toContain("satisfiesRange(workersTypesInstalledVersion, workersTypesPeerRange)");
  });

  it("keeps full CI deterministic without requiring a generated snapshot commit", () => {
    expect(ciWorkflow).toContain("dependency-preflight:");
    expect(ciWorkflow).toContain("Run deterministic dependency policy and audits");
    expect(ciWorkflow).toContain("pnpm deps:check -- --skip-documentation-freshness");
    expect(ciWorkflow).toContain("pnpm deps:docs:audit -- --skip-status-hashes");
    expect(ciWorkflow).not.toContain("pnpm deps:status:check");
    expect(ciWorkflow.match(/needs: dependency-preflight/gmu)?.length).toBe(8);
  });

  it("keeps snapshot mutation out of the normal Renovate PR lifecycle", () => {
    expect(dependenciesWorkflow).toContain("name: Dependency Monitor");
    expect(dependenciesWorkflow).toContain("snapshot-repair:");
    expect(dependenciesWorkflow).toContain("workflow_dispatch:");
    expect(dependenciesWorkflow).not.toContain("  pull_request:");
    expect(dependenciesWorkflow).not.toContain("HEAD:refs/heads/$HEAD_BRANCH");
    expect(dependenciesWorkflow).toContain("automation/dependency-status-sync");
    expect(dependenciesWorkflow).toContain("Report repair branch (maintainer PR required)");
    expect(dependenciesWorkflow).toContain("No pull request was created or merged");
  });

  it("retires the branch-mutating auto-format workflow", () => {
    expect(existsSync(join(repositoryRoot, ".github", "workflows", "format-guard.yml"))).toBe(false);
    expect(existsSync(join(repositoryRoot, ".github", "workflows", "pr-prettier-autofix.yml"))).toBe(false);
    expect(ciWorkflow).toContain("pnpm format:check");
  });

  it("keeps the quality bridge scoped to manual snapshot repair", () => {
    expect(dependenciesWorkflow).toContain("bash scripts/validate-required-quality.sh");
    expect(qualityBridgeScript).toContain('gh workflow run ci.yml --ref "$TARGET_BRANCH"');
    expect(qualityBridgeScript).toContain("statuses/$TARGET_SHA");
    expect(qualityBridgeScript).toContain('-f context="quality"');
  });

  it("reports ordinary freshness backlog without failing the scheduled monitor", () => {
    expect(dependenciesWorkflow).toContain("node scripts/generate-dependency-status.mjs --monitor");
    expect(dependenciesWorkflow).not.toContain("pnpm deps:latest:check");
    expect(dependencyStatusScript).toContain('const monitoringOnly = flags.has("--monitor");');
    expect(dependencyStatusScript).toContain(
      "Eligible dependency updates are pending Renovate or manual review (informational):"
    );
  });
});
