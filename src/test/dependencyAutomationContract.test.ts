// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const renovate = JSON.parse(readFileSync(join(repositoryRoot, "renovate.json"), "utf8")) as Record<string, unknown>;
const monitoringWorkflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "dependency-monitoring.yml"),
  "utf8"
);
const dependencyStatusScript = readFileSync(join(repositoryRoot, "scripts", "generate-dependency-status.mjs"), "utf8");
const dependencyCheckScript = readFileSync(join(repositoryRoot, "scripts", "check-dependencies.mjs"), "utf8");

describe("dependency automation contract", () => {
  it("keeps Renovate visible while serializing normal dependency churn", () => {
    expect(renovate.dependencyDashboard).toBe(true);
    expect(renovate).not.toHaveProperty("schedule");
    expect(renovate.prConcurrentLimit).toBe(2);
    expect(renovate.branchConcurrentLimit).toBe(2);
    expect(renovate.prHourlyLimit).toBe(1);
    expect(renovate.commitHourlyLimit).toBe(2);
    expect(renovate.rebaseWhen).toBe("behind-base-branch");
    expect(renovate.recreateWhen).toBe("auto");
  });

  it("preserves release-age, major-review, selective grouping, and known-regression controls", () => {
    const packageRules = renovate.packageRules as Array<Record<string, unknown>>;
    expect(packageRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          minimumReleaseAge: "3 days",
          internalChecksFilter: "strict"
        }),
        expect.objectContaining({
          matchUpdateTypes: ["major"],
          automerge: false
        }),
        expect.objectContaining({
          matchPackageNames: ["wrangler", "@cloudflare/workers-types"],
          matchUpdateTypes: ["patch", "minor"],
          groupName: "cloudflare toolchain"
        }),
        expect.objectContaining({
          matchPackageNames: ["@tanstack/react-query", "@tanstack/react-router"],
          matchUpdateTypes: ["patch", "minor"],
          groupName: "tanstack runtime"
        }),
        expect.objectContaining({
          matchManagers: ["github-actions"],
          groupName: "github actions"
        })
      ])
    );

    expect(
      packageRules.some((rule) =>
        (rule.matchPackageNames as string[] | undefined)?.some((name) =>
          ["react", "react-dom", "@types/react", "@types/react-dom", "jsdom"].includes(name)
        ) && typeof rule.allowedVersions === "string" && rule.allowedVersions.startsWith("!/")
      )
    ).toBe(false);
  });

  it("treats compatibility policy selected versions as same-major anchors", () => {
    expect(dependencyStatusScript).toContain("const policySelected = parseVersion(exception?.selected);");
    expect(dependencyStatusScript).toContain("const selected = installedVersion;");
    expect(dependencyStatusScript).toContain(
      "installed selected major ${selected.major} does not match configured compatibility anchor major ${policySelected.major}"
    );
    expect(dependencyCheckScript).toContain("const selected = parseVersion(installedPackage?.version);");
    expect(dependencyCheckScript).toContain(
      "installed selected major does not match the configured compatibility anchor major"
    );
  });

  it("reports ordinary freshness backlog without failing the scheduled monitor", () => {
    expect(monitoringWorkflow).toContain("node scripts/generate-dependency-status.mjs --monitor");
    expect(monitoringWorkflow).not.toContain("pnpm deps:latest:check");
    expect(dependencyStatusScript).toContain('const monitoringOnly = flags.has("--monitor");');
    expect(dependencyStatusScript).toContain(
      "Eligible dependency updates are pending Renovate or manual review (informational):"
    );
    expect(dependencyStatusScript).toContain(
      'policyErrors.length || auditFailures.length || (flags.has("--enforce-latest") && enforcementFailures.length)'
    );
  });
});
