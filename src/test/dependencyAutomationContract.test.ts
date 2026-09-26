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
const formatGuardWorkflow = readFileSync(join(repositoryRoot, ".github", "workflows", "format-guard.yml"), "utf8");
const qualityBridgeScript = readFileSync(join(repositoryRoot, "scripts", "validate-required-quality.sh"), "utf8");
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

  it("aligns Renovate and pnpm release-age enforcement without bump artifacts", () => {
    expect(renovate.extends).toEqual(expect.arrayContaining(["security:minimumReleaseAgeNpm"]));
    expect(renovate.rangeStrategy).toBe("update-lockfile");
    expect(renovate.minimumReleaseAgeBuffer).toBe("6 hours");
    expect(pnpmWorkspace).toContain("minimumReleaseAge: 4320");
  });

  it("preserves major-review, selective grouping, and no stale temporary holds", () => {
    const packageRules = renovate.packageRules as Array<Record<string, unknown>>;
    expect(packageRules).toEqual(
      expect.arrayContaining([
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

  it("validates Cloudflare lockfile updates against declared semver ranges", () => {
    expect(dependencyCheckScript).toContain('const wranglerSpecifier = directSpecifier("wrangler");');
    expect(dependencyCheckScript).toContain("const wranglerInstalledVersion = parseVersion(wrangler?.version);");
    expect(dependencyCheckScript).toContain(
      'const workersTypesSpecifier = directSpecifier("@cloudflare/workers-types");'
    );
    expect(dependencyCheckScript).toContain(
      "const workersTypesInstalledVersion = parseVersion(workersTypesPackage?.version);"
    );
    expect(dependencyCheckScript).toContain("satisfiesRange(wranglerInstalledVersion, wranglerSpecifier)");
    expect(dependencyCheckScript).toContain("satisfiesRange(workersTypesInstalledVersion, workersTypesSpecifier)");
    expect(dependencyCheckScript).toContain("satisfiesRange(workersTypesInstalledVersion, workersTypesPeerRange)");
    expect(dependencyCheckScript).not.toContain("wrangler?.version === wranglerVersion.raw");
  });

  it("gates full CI behind one dependency artifact preflight", () => {
    expect(ciWorkflow).toContain("dependency-preflight:");
    expect(ciWorkflow).toContain("name: Dependency Preflight");
    expect(ciWorkflow).toContain("Validate dependency artifact before full CI");
    expect(ciWorkflow.match(/needs: dependency-preflight/gmu)?.length).toBe(8);
    expect(ciWorkflow).toContain("DEPENDENCY_PREFLIGHT: ${{ needs.dependency-preflight.result }}");
    expect(ciWorkflow).toContain('test "$DEPENDENCY_PREFLIGHT" = "success"');
  });

  it("requires a complete Renovate artifact before snapshot synchronization", () => {
    expect(dependencyStatusSyncWorkflow).toContain("Reject incomplete Renovate dependency artifact");
    expect(dependencyStatusSyncWorkflow).toContain('grep -Fxq "package.json"');
    expect(dependencyStatusSyncWorkflow).toContain('grep -Fxq "pnpm-lock.yaml"');
    expect(dependencyStatusSyncWorkflow).toContain("Renovate changed package.json without pnpm-lock.yaml");
    expect(dependencyStatusSyncWorkflow).toContain("Install validated dependency artifact for snapshot generation");
  });

  it("requires committed dependency status before Renovate CI can pass", () => {
    expect(ciWorkflow).not.toContain("Refresh dependency status for Renovate update");
    expect(ciWorkflow).not.toContain("run: pnpm deps:status");
    expect(ciWorkflow).toContain("pnpm deps:status:check");
    expect(dependencyStatusSyncWorkflow).toContain("pull_request:");
    expect(dependencyStatusSyncWorkflow).toContain("github.event.pull_request.user.login == 'renovate[bot]'");
    expect(dependencyStatusSyncWorkflow).toContain("docs(deps): refresh dependency status");
    expect(dependencyStatusSyncWorkflow).toContain('git push origin "HEAD:refs/heads/$HEAD_BRANCH"');
    expect(dependencyStatusSyncWorkflow).toContain("github.event_name == 'push'");
  });

  it("distinguishes committed dependency drift from registry-only movement on master", () => {
    expect(dependencyStatusSyncWorkflow).toContain("Check committed dependency snapshot input hashes");
    expect(dependencyStatusSyncWorkflow).toContain("pnpm deps:status:check");
    expect(dependencyStatusSyncWorkflow).toContain('echo "current=true" >> "$GITHUB_OUTPUT"');
    expect(dependencyStatusSyncWorkflow).toContain(
      "Registry-only movement remains the responsibility of scheduled monitoring and Renovate."
    );
    expect(dependencyStatusSyncWorkflow).toContain("Fail closed on genuine post-merge snapshot drift");
    expect(dependencyStatusSyncWorkflow).toContain("automation/dependency-status-sync");
  });

  it("bridges current bot-created branch heads to the protected quality status", () => {
    expect(dependencyStatusSyncWorkflow).toContain("statuses: write");
    expect(formatGuardWorkflow).toContain("statuses: write");
    expect(dependencyStatusSyncWorkflow).toContain("Resolve required quality validation target");
    expect(dependencyStatusSyncWorkflow).toContain("id: validation_target");
    expect(dependencyStatusSyncWorkflow).toContain(
      "if: github.event_name == 'pull_request' || steps.repair_commit.outputs.branch != ''"
    );
    expect(dependencyStatusSyncWorkflow).toContain('target_sha="$(git rev-parse HEAD)"');
    expect(dependencyStatusSyncWorkflow).toContain("Validate updated head and publish required quality status");
    expect(formatGuardWorkflow).toContain("Validate corrected head and publish required quality status");
    expect(dependencyStatusSyncWorkflow).toContain("bash scripts/validate-required-quality.sh");
    expect(formatGuardWorkflow).toContain("bash scripts/validate-required-quality.sh");
    expect(qualityBridgeScript).toContain('ci_run_id="$(latest_dispatch_run_id)"');
    expect(qualityBridgeScript).toContain('if [ -n "$ci_run_id" ]; then');
    expect(qualityBridgeScript).toContain("Reusing existing canonical CI run");
    expect(qualityBridgeScript).toContain('gh workflow run ci.yml --ref "$TARGET_BRANCH"');
    expect(qualityBridgeScript).toContain("statuses/$TARGET_SHA");
    expect(qualityBridgeScript).toContain('-f context="quality"');
    expect(qualityBridgeScript).toContain('quality_state="success"');
    expect(qualityBridgeScript).toContain('test "$quality_state" = "success"');
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