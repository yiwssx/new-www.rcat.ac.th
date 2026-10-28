import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const FUNCTIONAL_SPEC = /^tests\/functional\/[A-Za-z0-9_./-]+\.spec\.(?:ts|tsx|js|jsx)$/;
const DOC_PATH = /^(?:docs\/[A-Za-z0-9_./-]+|README\.md|CHANGELOG\.md|CONTRIBUTING\.md)$/;
const MAX_SELECTED_SPECS = 20;

export function selectFunctionalTestCommand(plan, eventName, fileIsRegular) {
  const fallback = { mode: "full", command: "pnpm", args: ["test:functional"], reason: "conservative-default" };

  if (
    eventName !== "pull_request" ||
    !plan ||
    plan.mode !== "affected" ||
    plan.gateReady !== true ||
    plan.verifiedIntegration !== true ||
    !Array.isArray(plan.changedPaths) ||
    plan.changedPaths.length === 0 ||
    plan.changedPaths.length > MAX_SELECTED_SPECS ||
    !Array.isArray(plan.areas) ||
    !plan.areas.includes("functional") ||
    plan.areas.some((area) => area !== "functional" && area !== "documentation") ||
    !Array.isArray(plan.requiredLanes) ||
    !plan.requiredLanes.includes("functional")
  ) {
    return fallback;
  }

  const specs = [];
  for (const path of plan.changedPaths) {
    if (typeof path !== "string" || path.includes("\\") || path.includes("\0") || path.startsWith("/")) {
      return fallback;
    }

    if (DOC_PATH.test(path)) continue;

    if (
      !FUNCTIONAL_SPEC.test(path) ||
      path.split("/").some((part) => part === "." || part === ".." || part === "") ||
      !fileIsRegular(path)
    ) {
      return fallback;
    }

    specs.push(path);
  }

  if (specs.length === 0 || new Set(specs).size !== specs.length) return fallback;

  return {
    mode: "selected-specs",
    command: "pnpm",
    args: ["exec", "playwright", "test", ...specs.sort()],
    reason: "verified-pr-changed-existing-functional-specs"
  };
}

function isRegularFile(path) {
  try {
    const stat = lstatSync(resolve(path));
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

if (process.argv[1] && process.argv[1].replaceAll("\\", "/").endsWith("/run-affected-functional.mjs")) {
  let plan;
  try {
    plan = JSON.parse(process.env.CI_PLAN ?? "null");
  } catch {
    plan = null;
  }

  const choice = selectFunctionalTestCommand(plan, process.env.GITHUB_EVENT_NAME, isRegularFile);
  console.log("[CI Functional E2E] " + choice.mode + ": " + choice.reason);
  const result = spawnSync(choice.command, choice.args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
