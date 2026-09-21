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
const ciWorkflow = readFileSync(join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8");
const dependencyStatusSyncWorkflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "dependency-status-sync.yml"),
  "utf8"
);
const dependencyStatusScript = readFileSync(join(repositoryRoot, "scripts", "generate-dependency-status.mjs"), "utf8");
const dependencyCheckScript = readFileSync(join(repositoryRoot, "scripts", "check-dependencies.mjs"), "utf8");
const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};
const pnpmWorkspace = readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
const muiFocusTrapPatch = readFileSync(join(repositoryRoot, "patches", "@mui__material@9.4.0.patch"), "utf8");

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
    expect(renovate.gitIgnoredAuthors).toEqual(["41898282+github-actions[bot]@users.noreply.github.com"]);
  });

  it("preserves release-age, major-review, selective grouping, and no stale temporary holds", () => {
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
      packageRules.some(
        (rule) =>
          (rule.matchPackageNames as string[] | undefined)?.some((name) =>
            ["react", "react-dom", "@types/react", "@types/react-dom", "jsdom"].includes(name)
          ) &&
          typeof rule.allowedVersions === "string" &&
          rule.allowedVersions.startsWith("!/")
      )
    ).toBe(false);
  });

  it("keeps retired JWT libraries out of direct runtime dependencies", () => {
    expect(packageJson.dependencies).not.toHaveProperty("jose");
    expect(packageJson.dependencies).not.toHaveProperty("jwt-decode");
  });

  it("keeps the jsdom 30.1 MUI focus-restoration compatibility patch narrow", () => {
    expect(pnpmWorkspace).toContain('"@mui/material@9.4.0": patches/@mui__material@9.4.0.patch');
    expect(muiFocusTrapPatch).toContain('typeof nodeToRestore.current?.focus === "function"');
    expect(muiFocusTrapPatch.match(/^diff --git /gmu)).toHaveLength(2);
    expect(muiFocusTrapPatch).toContain("Unstable_TrapFocus/FocusTrap.js");
    expect(muiFocusTrapPatch).toContain("Unstable_TrapFocus/FocusTrap.mjs");
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

  it("requires committed dependency status before Renovate CI can pass", () => {
    expect(ciWorkflow).not.toContain("Refresh dependency status for Renovate update");
    expect(ciWorkflow).not.toContain("run: pnpm deps:status");
    expect(ciWorkflow).toContain("pnpm deps:status:check");
    expect(dependencyStatusSyncWorkflow).toContain("pull_request:");
    expect(dependencyStatusSyncWorkflow).toContain("github.event.pull_request.user.login == 'renovate[bot]'");
    expect(dependencyStatusSyncWorkflow).toContain("docs(deps): refresh dependency status");
    expect(dependencyStatusSyncWorkflow).toContain('git push origin "HEAD:refs/heads/$HEAD_BRANCH"');
    expect(dependencyStatusSyncWorkflow).toContain('gh workflow run ci.yml --ref "$HEAD_BRANCH"');
    expect(dependencyStatusSyncWorkflow).toContain("github.event_name == 'push'");
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
