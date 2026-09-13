import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const dryRun = process.env.DRY_RUN === "true";

if (!token || !repository) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");

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
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${body?.message || text || response.statusText}`);
  return body;
}

async function listDeployments() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/repos/${repository}/deployments?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

function isLegacyActionsPseudoDeployment(deployment) {
  if (String(deployment.environment || "").toLowerCase() !== "production") return false;
  const login = String(deployment.creator?.login || "").toLowerCase();
  const app = String(deployment.performed_via_github_app?.slug || "").toLowerCase();
  return login === "github-actions[bot]" || app === "github-actions";
}

const deployments = await listDeployments();
let failed = 0;
let pseudo = 0;
let deleted = 0;

for (const deployment of deployments) {
  const statuses = await github(`/repos/${repository}/deployments/${deployment.id}/statuses?per_page=1`);
  const latestState = statuses[0]?.state || "pending";
  const failedHistory = latestState === "failure" || latestState === "error";
  const legacyPseudo = isLegacyActionsPseudoDeployment(deployment);
  if (!failedHistory && !legacyPseudo) continue;

  if (failedHistory) failed += 1;
  if (legacyPseudo) pseudo += 1;
  console.log(`${dryRun ? "Would delete" : "Deleting"} deployment ${deployment.id}: environment=${deployment.environment} state=${latestState} creator=${deployment.creator?.login || "unknown"}`);
  if (dryRun) continue;

  if (latestState !== "inactive") {
    await github(`/repos/${repository}/deployments/${deployment.id}/statuses`, {
      method: "POST",
      body: JSON.stringify({
        state: "inactive",
        environment: deployment.environment,
        description: "Deployment history taxonomy cleanup"
      })
    });
  }
  await github(`/repos/${repository}/deployments/${deployment.id}`, { method: "DELETE" });
  deleted += 1;
}

const summary = [
  "## Deployment History Maintenance",
  "",
  `- Examined: ${deployments.length}`,
  `- Failed/error records matched: ${failed}`,
  `- Legacy GitHub Actions production pseudo-deployments matched: ${pseudo}`,
  `- Deleted: ${deleted}`,
  `- Dry run: ${dryRun}`,
  "- Successful Vercel and service-specific deployment records are preserved"
].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
