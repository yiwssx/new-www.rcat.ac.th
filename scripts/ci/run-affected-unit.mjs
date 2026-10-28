import { spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { resolve } from "node:path";

const UNIT_TEST_PATH = /^src\/test\/(?!integration\/)[A-Za-z0-9_./-]+\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs)$/;
const DOC_PATH = /^(?:docs\/[A-Za-z0-9_./-]+|README\.md|CHANGELOG\.md|CONTRIBUTING\.md)$/;
const BASE_ARGS = ["scripts/run-vitest.mjs", "run"];
const MAX_SCOPED_FILES = 30;
const CALENDAR_SOURCE = "src/utils/calendar.ts";
const CALENDAR_TEST = "src/utils/calendar.test.ts";
const INTEGRATION_EXCLUDES = [
  "--exclude",
  "src/test/integration/**",
  "--exclude",
  "cloudflare/public-api/test/cmsMfaD1Integration.test.ts",
  "--exclude",
  "cloudflare/public-api/test/cmsUserLifecycleD1Integration.test.ts"
];


function realUnitTest(path, fileIsRegular) {
  if (!UNIT_TEST_PATH.test(path) || path.split("/").some((part) => part === ".." || part === ".")) {
    return false;
  }
  return fileIsRegular(path);
}

/**
 * Only direct edits to existing unit-test files are eligible for narrow execution.
 * Source-code, fixture, rename, deletion, and invalid-plan changes always run
 * the original complete unit suite (including its exclusions).
 */
export function selectUnitTestCommand(plan, eventName, fileIsRegular) {
  const full = { mode: "full", args: ["test:unit"], reason: "conservative-default" };
  // First source-code opt-in: keep all cross-domain CI lanes, but select
  // statically related Vitest unit tests for this explicitly reviewed utility.
  // Vitest related cannot track arbitrary dynamic import paths, so unknown,
  // shared, deleted, renamed or multi-source changes keep the full suite.
  if (
    eventName === "pull_request" &&
    plan?.mode === "affected" &&
    plan.gateReady === true &&
    plan.verifiedIntegration === true &&
    Array.isArray(plan.changedPaths) &&
    plan.changedPaths.includes(CALENDAR_SOURCE) &&
    plan.changedPaths.length <= 10 &&
    plan.changedPaths.every(
      (path) =>
        path === CALENDAR_SOURCE ||
        (typeof path === "string" &&
          DOC_PATH.test(path) &&
          !path.split("/").some((part) => part === "." || part === ".."))
    ) &&
    Array.isArray(plan.areas) &&
    plan.areas.includes("admin") &&
    plan.areas.every((area) => area === "admin" || area === "documentation") &&
    Array.isArray(plan.requiredLanes) &&
    ["static-quality", "unit", "integration", "build", "governance", "functional"].every((lane) =>
      plan.requiredLanes.includes(lane)
    ) &&
    fileIsRegular(CALENDAR_SOURCE) &&
    fileIsRegular(CALENDAR_TEST)
  ) {
    return {
      mode: "related-source",
      args: [...BASE_ARGS.slice(0, 1), "related", "--run", ...INTEGRATION_EXCLUDES, CALENDAR_SOURCE],
      reason: "verified-calendar-module-with-direct-test-anchor"
    };
  }

  if (
    eventName !== "pull_request" ||
    !plan ||
    plan.mode !== "affected" ||
    plan.gateReady !== true ||
    plan.verifiedIntegration !== true ||
    !Array.isArray(plan.changedPaths) ||
    plan.changedPaths.length === 0 ||
    plan.changedPaths.length > MAX_SCOPED_FILES ||
    !Array.isArray(plan.areas) ||
    !plan.areas.includes("unit") ||
    plan.areas.some((area) => !["unit", "documentation"].includes(area)) ||
    !Array.isArray(plan.requiredLanes) ||
    !plan.requiredLanes.includes("unit")
  ) {
    return full;
  }

  const files = [];
  for (const path of plan.changedPaths) {
    if (typeof path !== "string" || path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
      return full;
    }

    if (DOC_PATH.test(path)) {
      continue;
    }
    if (!realUnitTest(path, fileIsRegular)) {
      return full;
    }
    files.push(path);
  }

  if (!files.length || new Set(files).size !== files.length) return full;
  return {
    mode: "selected-tests",
    args: [...BASE_ARGS, ...files.sort()],
    reason: "verified-pr-changed-existing-unit-tests"
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

function runCIUnitTests(env = process.env) {
  let plan;
  try {
    plan = JSON.parse(env.CI_PLAN ?? "null");
  } catch {
    plan = null;
  }

  const choice = selectUnitTestCommand(plan, env.GITHUB_EVENT_NAME, isRegularFile);
  console.log("[CI Unit Tests] " + choice.mode + ": " + choice.reason);

  const isSelected = choice.mode === "selected-tests" || choice.mode === "related-source";
  const command = isSelected ? "node" : "pnpm";
  const args = choice.args;
  const result = spawnSync(command, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && process.argv[1].replaceAll("\\", "/").endsWith("/run-affected-unit.mjs")) {
  runCIUnitTests();
}
