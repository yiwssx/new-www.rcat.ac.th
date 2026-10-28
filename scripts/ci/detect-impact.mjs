import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { createImpactPlan, defaultImpactMap } from "./impact-plan.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export function parseChangedFiles(output) {
  if (!output || !output.endsWith("\0")) {
    throw new Error("Incomplete or empty git diff");
  }

  const tokens = output.slice(0, -1).split("\0");
  const entries = [];

  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (status === "A" || status === "M" || status === "D") {
      if (index >= tokens.length) throw new Error("Incomplete git diff path");
      const path = tokens[index++];
      if (!path) throw new Error("Empty git diff path");
      entries.push({ path, status: status === "A" ? "added" : status === "D" ? "deleted" : "modified" });
    } else if (/^R[0-9]{1,3}$/.test(status)) {
      if (index + 1 >= tokens.length) throw new Error("Incomplete git rename");
      const previousPath = tokens[index++];
      const path = tokens[index++];
      if (!path || !previousPath) throw new Error("Empty git rename path");
      entries.push({ status: "renamed", path, previousPath });
    } else {
      throw new Error("Unsupported git change status: " + status);
    }
  }

  return entries;
}

function allLanes(reason) {
  return { ...createImpactPlan([]), reasons: [reason], gateReady: false, verifiedIntegration: false };
}

export function selectCIPlan({ eventName, baseSha, eventSha, checkoutSha, firstParentSha, changes }) {
  if (eventName !== "pull_request") {
    return allLanes("full-source-validation:" + String(eventName || "unknown"));
  }

  if (
    ![baseSha, eventSha, checkoutSha, firstParentSha].every((value) => SHA_PATTERN.test(value ?? "")) ||
    eventSha !== checkoutSha ||
    firstParentSha !== baseSha ||
    !Array.isArray(changes) ||
    changes.length === 0
  ) {
    return allLanes("unverified-pull-request-merge-or-change-range");
  }

  const plan = createImpactPlan(changes);
  return {
    ...plan,
    gateReady: plan.mode === "affected",
    verifiedIntegration: true,
    baseSha,
    checkoutSha
  };
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
}

function selectFromCheckout(env) {
  if (env.GITHUB_EVENT_NAME !== "pull_request") {
    return selectCIPlan({ eventName: env.GITHUB_EVENT_NAME });
  }

  try {
    const baseSha = env.CI_PR_BASE_SHA;
    const eventSha = env.GITHUB_SHA;
    const checkoutSha = git("rev-parse", "HEAD");
    const parents = git("rev-list", "--parents", "-n", "1", "HEAD").split(/\s+/);
    const firstParentSha = parents.length === 3 ? parents[1] : null;
    if (
      ![baseSha, eventSha, checkoutSha, firstParentSha].every((value) => SHA_PATTERN.test(value ?? "")) ||
      eventSha !== checkoutSha ||
      firstParentSha !== baseSha
    ) {
      return allLanes("invalid-or-stale-github-merge-commit");
    }

    const raw = execFileSync("git", ["diff", "--name-status", "-z", "--no-ext-diff", baseSha, checkoutSha], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    });

    return selectCIPlan({
      eventName: env.GITHUB_EVENT_NAME,
      baseSha,
      eventSha,
      checkoutSha,
      firstParentSha,
      changes: parseChangedFiles(raw)
    });
  } catch (error) {
    return allLanes("git-diff-unavailable:" + (error instanceof Error ? error.name : "unknown"));
  }
}

export function formatImpactOutputs(plan) {
  const lines = ["plan=" + JSON.stringify(plan)];
  for (const lane of defaultImpactMap.lanes) {
    lines.push("require_" + lane.replaceAll("-", "_") + "=" + String(plan.requiredLanes.includes(lane)));
  }
  return lines.join("\n") + "\n";
}

if (process.argv[1] && process.argv[1].endsWith("/detect-impact.mjs")) {
  const plan = selectFromCheckout(process.env);
  const summary = [
    "### RCAT CI change impact",
    "",
    "- Event: " + (process.env.GITHUB_EVENT_NAME ?? "unknown"),
    "- Mode: " + plan.mode,
    "- Integration verified: " + plan.verifiedIntegration,
    "- Required lanes: " + plan.requiredLanes.join(", "),
    "- Skipped lanes: " + (plan.skippedLanes.join(", ") || "none"),
    "- Reasons: " + plan.reasons.join("; "),
    "",
    "Uncertain git history and unknown paths run the full suite."
  ].join("\n");

  if (!process.env.GITHUB_OUTPUT || !process.env.GITHUB_STEP_SUMMARY) {
    throw new Error("GitHub output and summary files must exist");
  }

  appendFileSync(process.env.GITHUB_OUTPUT, formatImpactOutputs(plan));
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  console.log(summary);
}
