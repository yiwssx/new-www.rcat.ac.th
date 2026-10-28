import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DOCS = new Set(["README.md", "CHANGELOG.md", "CONTRIBUTING.md"]);
const DOC_FILE = /^docs\/(?:[A-Za-z0-9._ -]+\/)*[A-Za-z0-9._ -]+\.(?:md|mdx|json|ya?ml)$/;
const MAX_CHANGED_DOCUMENTS = 60;

function isSupportedDocument(path) {
  return (
    typeof path === "string" &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    !path.startsWith("/") &&
    !path.split("/").some((part) => part === "." || part === ".." || part === "") &&
    (ROOT_DOCS.has(path) || DOC_FILE.test(path))
  );
}

export function selectStaticQualityCommands(plan, eventName, regularFileExists) {
  const full = {
    mode: "full",
    reason: "conservative-default",
    commands: [["format:check"], ["lint:strict"]]
  };

  if (
    eventName !== "pull_request" ||
    plan?.mode !== "affected" ||
    plan.gateReady !== true ||
    plan.verifiedIntegration !== true ||
    plan.version !== 1 ||
    !Array.isArray(plan.changedPaths) ||
    plan.changedPaths.length === 0 ||
    plan.changedPaths.length > MAX_CHANGED_DOCUMENTS ||
    !Array.isArray(plan.areas) ||
    plan.areas.length !== 1 ||
    plan.areas[0] !== "documentation" ||
    !Array.isArray(plan.requiredLanes) ||
    plan.requiredLanes.length !== 1 ||
    plan.requiredLanes[0] !== "static-quality" ||
    !Array.isArray(plan.reasons) ||
    plan.reasons.length === 0
  ) {
    return full;
  }

  const paths = [...plan.changedPaths];
  if (
    new Set(paths).size !== paths.length ||
    !paths.every((path) => isSupportedDocument(path) && regularFileExists(path))
  ) {
    return full;
  }

  return {
    mode: "docs-only",
    reason: "verified-pr-changed-existing-documents",
    commands: [["exec", "prettier", "--check", ...paths.sort()]]
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

function runQuality() {
  let plan = null;
  try {
    plan = JSON.parse(process.env.CI_PLAN ?? "null");
  } catch {
    // Invalid plan must retain both full static checks.
  }

  const selection = selectStaticQualityCommands(plan, process.env.GITHUB_EVENT_NAME, isRegularFile);
  console.log("[CI Static Quality] " + selection.mode + ": " + selection.reason);

  for (const args of selection.commands) {
    const result = spawnSync("pnpm", args, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32"
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

if (process.argv[1] && process.argv[1].replaceAll("\\", "/").endsWith("/run-affected-static.mjs")) {
  runQuality();
}
