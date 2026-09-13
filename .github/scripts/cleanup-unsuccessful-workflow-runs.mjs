import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const dryRun = process.env.DRY_RUN === "true";
const currentRunId = Number(process.env.GITHUB_RUN_ID || 0);

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

async function listCompletedRuns() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const result = await github(`/repos/${repository}/actions/runs?status=completed&per_page=100&page=${page}`);
    const batch = result?.workflow_runs || [];
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

const runs = await listCompletedRuns();
const targets = runs.filter((run) => run.id !== currentRunId && run.conclusion && run.conclusion !== "success");

const byConclusion = new Map();
for (const run of targets) {
  byConclusion.set(run.conclusion, (byConclusion.get(run.conclusion) || 0) + 1);
}

let deleted = 0;
for (const run of targets) {
  console.log(
    `${dryRun ? "Would delete" : "Deleting"} workflow run ${run.id}: workflow=${run.name} conclusion=${run.conclusion} branch=${run.head_branch || "unknown"}`
  );
  if (dryRun) continue;
  await github(`/repos/${repository}/actions/runs/${run.id}`, { method: "DELETE" });
  deleted += 1;
}

const conclusionSummary = [...byConclusion.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([conclusion, count]) => `- ${conclusion}: ${count}`);

const summary = [
  "## Actions History Maintenance",
  "",
  `- Completed runs examined: ${runs.length}`,
  `- Unsuccessful completed runs matched: ${targets.length}`,
  `- Deleted: ${deleted}`,
  `- Dry run: ${dryRun}`,
  "- Successful runs preserved: yes",
  ...(conclusionSummary.length ? ["", "### Matched conclusions", ...conclusionSummary] : [])
].join("\n");

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
