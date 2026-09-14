import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const dryRun = process.env.DRY_RUN === "true";
const currentRunId = Number(process.env.GITHUB_RUN_ID || 0);
const now = Date.now();

const retentionDaysByStatus = new Map([
  ["failure", 180],
  ["timed_out", 180],
  ["action_required", 180],
  ["neutral", 30],
  ["stale", 30],
  ["cancelled", 14],
  ["skipped", 14]
]);

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

function getCompletedAt(run) {
  const timestamp = Date.parse(run.updated_at || run.run_started_at || run.created_at || "");
  return Number.isFinite(timestamp) ? timestamp : now;
}

function isPastRetention(run, retentionDays) {
  return now - getCompletedAt(run) >= retentionDays * 24 * 60 * 60 * 1000;
}

async function listRetainedStatusTargets(status, retentionDays) {
  const targets = [];

  for (let page = 1; ; page += 1) {
    const result = await github(runsPath(status, page));
    const allRuns = result?.workflow_runs || [];
    const batch = allRuns.filter(
      (run) => run.id !== currentRunId && run.status === "completed" && isPastRetention(run, retentionDays)
    );
    targets.push(...batch);

    if (allRuns.length < 100) {
      return targets;
    }
  }
}

const byConclusion = new Map();
let examined = 0;
let matched = 0;
let deleted = 0;

for (const [status, retentionDays] of retentionDaysByStatus.entries()) {
  const targets = await listRetainedStatusTargets(status, retentionDays);
  examined += targets.length;

  for (const run of targets) {
    const conclusion = run.conclusion || status;
    byConclusion.set(conclusion, (byConclusion.get(conclusion) || 0) + 1);
    matched += 1;

    console.log(
      `${dryRun ? "Would delete" : "Deleting"} workflow run ${run.id}: workflow=${run.name} conclusion=${conclusion} branch=${run.head_branch || "unknown"} retention=${retentionDays}d completed=${run.updated_at || run.created_at || "unknown"}`
    );

    if (dryRun) continue;
    await github(`/repos/${repository}/actions/runs/${run.id}`, { method: "DELETE" });
    deleted += 1;
  }
}

const conclusionSummary = [...byConclusion.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([conclusion, count]) => `- ${conclusion}: ${count}`);

const retentionSummary = [...retentionDaysByStatus.entries()].map(([status, days]) => `- ${status}: ${days} days`);

const summary = [
  "## Actions History Maintenance",
  "",
  `- Retention-expired runs examined: ${examined}`,
  `- Retention-expired runs matched: ${matched}`,
  `- Deleted: ${deleted}`,
  `- Dry run: ${dryRun}`,
  "- Successful runs preserved: yes",
  "- Queued/in-progress runs preserved: yes",
  "- Recent failure evidence preserved: yes",
  "",
  "### Retention policy",
  ...retentionSummary,
  ...(conclusionSummary.length ? ["", "### Matched conclusions", ...conclusionSummary] : [])
].join("\n");

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
