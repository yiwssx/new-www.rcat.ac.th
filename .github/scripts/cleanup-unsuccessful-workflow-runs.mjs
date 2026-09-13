import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const dryRun = process.env.DRY_RUN === "true";
const currentRunId = Number(process.env.GITHUB_RUN_ID || 0);
// Terminal non-success conclusions supported by the workflow-runs status filter.
const targetStatuses = ["failure", "cancelled", "skipped", "action_required", "neutral", "timed_out", "stale"];

if (!token || !repository) {
  throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
}

async function github(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  if (response.status === 204) return null;

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${body?.message || text || response.statusText}`);
  }
  return body;
}

function runsPath(status, page = 1) {
  return `/repos/${repository}/actions/runs?status=${encodeURIComponent(status)}&per_page=100&page=${page}`;
}

function recordMatch(run, fallbackStatus, byConclusion) {
  const conclusion = run.conclusion || fallbackStatus;
  byConclusion.set(conclusion, (byConclusion.get(conclusion) || 0) + 1);
}

async function inspectStatus(status, byConclusion) {
  let matched = 0;
  for (let page = 1; ; page += 1) {
    const result = await github(runsPath(status, page));
    const batch = (result?.workflow_runs || []).filter((run) => run.id !== currentRunId);
    for (const run of batch) {
      recordMatch(run, status, byConclusion);
      matched += 1;
      console.log(
        `Would delete workflow run ${run.id}: workflow=${run.name} conclusion=${run.conclusion || status} branch=${run.head_branch || "unknown"}`
      );
    }
    if ((result?.workflow_runs || []).length < 100) return matched;
  }
}

async function deleteStatus(status, byConclusion) {
  let deleted = 0;

  // Always read page 1. Deleting a page shifts older matching runs forward,
  // avoiding GitHub's 1,000-result pagination ceiling for Actions history.
  for (;;) {
    const result = await github(runsPath(status));
    const batch = (result?.workflow_runs || []).filter((run) => run.id !== currentRunId);
    if (!batch.length) return deleted;

    for (const run of batch) {
      recordMatch(run, status, byConclusion);
      console.log(
        `Deleting workflow run ${run.id}: workflow=${run.name} conclusion=${run.conclusion || status} branch=${run.head_branch || "unknown"}`
      );
      await github(`/repos/${repository}/actions/runs/${run.id}`, { method: "DELETE" });
      deleted += 1;
    }
  }
}

const byConclusion = new Map();
let matched = 0;
let deleted = 0;

if (dryRun) {
  for (const status of targetStatuses) {
    matched += await inspectStatus(status, byConclusion);
  }
} else {
  // Repeat complete status sweeps so a non-success run that finishes while
  // cleanup is already running is picked up on the next sweep.
  for (;;) {
    let sweepDeleted = 0;
    for (const status of targetStatuses) {
      const count = await deleteStatus(status, byConclusion);
      sweepDeleted += count;
      deleted += count;
    }
    matched += sweepDeleted;
    if (sweepDeleted === 0) break;
  }
}

const conclusionSummary = [...byConclusion.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([conclusion, count]) => `- ${conclusion}: ${count}`);

const summary = [
  "## Actions History Maintenance",
  "",
  `- Non-success runs matched: ${matched}`,
  `- Deleted: ${deleted}`,
  `- Dry run: ${dryRun}`,
  "- Successful runs preserved: yes",
  "- Queued/in-progress runs preserved: yes",
  ...(conclusionSummary.length ? ["", "### Matched conclusions", ...conclusionSummary] : [])
].join("\n");

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
