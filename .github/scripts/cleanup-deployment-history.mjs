import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const dryRun = process.env.DRY_RUN === "true";
const now = Date.now();
const failedRetentionMs = 30 * 24 * 60 * 60 * 1000;
const staleInProgressMs = 6 * 60 * 60 * 1000;
const legacyActionsPseudoDeploymentCutoff = Date.parse("2026-09-13T06:52:00Z");

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

function deploymentCreatedAt(deployment) {
  const createdAt = Date.parse(deployment.created_at || "");
  return Number.isFinite(createdAt) ? createdAt : now;
}

function isLegacyActionsPseudoDeployment(deployment) {
  if (String(deployment.environment || "").toLowerCase() !== "production") return false;
  const login = String(deployment.creator?.login || "").toLowerCase();
  const app = String(deployment.performed_via_github_app?.slug || "").toLowerCase();
  const createdAt = deploymentCreatedAt(deployment);
  const createdByActions = login === "github-actions[bot]" || app === "github-actions";
  return createdByActions && createdAt < legacyActionsPseudoDeploymentCutoff;
}

function isStaleInProgressState(state) {
  return state === "queued" || state === "pending" || state === "in_progress";
}

const deployments = await listDeployments();
let failedExpired = 0;
let failedPreserved = 0;
let pseudo = 0;
let staleReconciled = 0;
let deleted = 0;

for (const deployment of deployments) {
  const statuses = await github(`/repos/${repository}/deployments/${deployment.id}/statuses?per_page=1`);
  const latestState = statuses[0]?.state || "pending";
  const ageMs = now - deploymentCreatedAt(deployment);
  const failedHistory = latestState === "failure" || latestState === "error";
  const expiredFailedHistory = failedHistory && ageMs >= failedRetentionMs;
  const legacyPseudo = isLegacyActionsPseudoDeployment(deployment);
  const staleInProgress = isStaleInProgressState(latestState) && ageMs >= staleInProgressMs;

  if (failedHistory && !expiredFailedHistory) {
    failedPreserved += 1;
  }

  if (staleInProgress) {
    staleReconciled += 1;
    console.log(
      `${dryRun ? "Would reconcile" : "Reconciling"} stale deployment ${deployment.id}: environment=${deployment.environment} state=${latestState} creator=${deployment.creator?.login || "unknown"}`
    );

    if (!dryRun) {
      await github(`/repos/${repository}/deployments/${deployment.id}/statuses`, {
        method: "POST",
        body: JSON.stringify({
          state: "inactive",
          environment: deployment.environment,
          description: "Stale deployment reconciled by repository history maintenance"
        })
      });
    }
  }

  if (!expiredFailedHistory && !legacyPseudo) continue;

  if (expiredFailedHistory) failedExpired += 1;
  if (legacyPseudo) pseudo += 1;
  console.log(
    `${dryRun ? "Would delete" : "Deleting"} deployment ${deployment.id}: environment=${deployment.environment} state=${latestState} creator=${deployment.creator?.login || "unknown"}`
  );
  if (dryRun) continue;

  if (latestState !== "inactive") {
    await github(`/repos/${repository}/deployments/${deployment.id}/statuses`, {
      method: "POST",
      body: JSON.stringify({
        state: "inactive",
        environment: deployment.environment,
        description: "Deployment history retention cleanup"
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
  `- Failed/error records past 30-day retention: ${failedExpired}`,
  `- Recent failed/error records preserved: ${failedPreserved}`,
  `- Legacy pre-taxonomy GitHub Actions production pseudo-deployments matched: ${pseudo}`,
  `- Stale queued/pending/in-progress deployments reconciled: ${staleReconciled}`,
  `- Deleted: ${deleted}`,
  `- Dry run: ${dryRun}`,
  "- Successful Vercel and service-specific deployment records are preserved",
  "- Future GitHub Actions deployment records are not classified as legacy solely by creator"
].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
