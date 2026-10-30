// @section: read-only CI canary, never part of required test selection.
import { spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// No other branch or source change may silently add a second browser run.
const CANARY_BRANCH = "ci/782-carousel-source-canary";
const CANARY_SOURCE = "src/public/utils/homeCarouselInteraction.ts";
const CANARY_SPECS = ["tests/functional/carousel.spec.ts"];

function regularFile(path) {
  try {
    const stat = lstatSync(resolve(path));
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function selectCanary(plan, eventName, headRef, fileIsRegular = regularFile) {
  const skipped = (reason) => ({ enabled: false, reason, specs: [] });
  if (eventName !== "pull_request" || headRef !== CANARY_BRANCH) {
    return skipped("not-the-explicit-PR-canary");
  }
  if (
    plan?.mode !== "affected" ||
    plan.gateReady !== true ||
    plan.verifiedIntegration !== true ||
    !Array.isArray(plan.changedPaths) ||
    plan.changedPaths.length !== 1 ||
    plan.changedPaths[0] !== CANARY_SOURCE ||
    !Array.isArray(plan.requiredLanes) ||
    !plan.requiredLanes.includes("functional")
  ) {
    return skipped("unverified-or-mixed-change");
  }
  if (![CANARY_SOURCE, ...CANARY_SPECS].every((path) => fileIsRegular(path))) {
    return skipped("absent-or-symlinked-source-or-spec");
  }
  return { enabled: true, reason: "verified-single-source-canary", specs: [...CANARY_SPECS] };
}

export function formatCanaryResult(choice, exitCode) {
  const text = [
    "### #782 Playwright source-change canary (non-gating)",
    "",
    "- Enabled: " + choice.enabled,
    "- Reason: " + choice.reason,
    "- Candidate test command is **diagnostic**; Full Functional E2E must run after this step.",
    "- Source candidate: " + CANARY_SOURCE
  ];
  if (choice.enabled) {
    text.push("- Candidate specs: " + choice.specs.join(", "));
    text.push("- Candidate exit status: " + (exitCode === null ? "unknown" : String(exitCode)));
  }
  text.push(
    "- This result cannot prove coverage completeness, satisfy quality, or skip any browser test.",
    ""
  );
  return text.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let plan;
  try {
    plan = JSON.parse(process.env.CI_PLAN ?? "null");
  } catch {
    plan = null;
  }
  const choice = selectCanary(plan, process.env.GITHUB_EVENT_NAME, process.env.GITHUB_HEAD_REF);
  let exitCode = null;
  if (choice.enabled) {
    console.log("[#782 canary] Running focused Playwright specs; full E2E follows independently.");
    const result = spawnSync("pnpm", ["exec", "playwright", "test", ...choice.specs, "--reporter=line"], {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
      timeout: 180000
    });
    exitCode = result.status;
    if (result.error) console.warn("[#782 canary] Non-gating execution error:", result.error.message);
    if (result.status !== 0) console.warn("[#782 canary] Candidate failed; full E2E is still mandatory.");
  }
  const report = formatCanaryResult(choice, exitCode);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
    } catch (error) {
      console.warn("[#782 canary] Optional summary write failed:", error);
    }
  }
  // Never mask or replace the gate; canary failures do not set process.exitCode.
}
