import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const environment = process.env.DEPLOYMENT_ENVIRONMENT;

if (!token || !repository || !environment) {
  throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, and DEPLOYMENT_ENVIRONMENT are required");
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
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${body?.message || text || response.statusText}`);
  }
  return body;
}

async function start() {
  const ref = process.env.GITHUB_SHA;
  if (!ref) throw new Error("GITHUB_SHA is required");
  const description = process.env.DEPLOYMENT_DESCRIPTION || `${environment} release`;
  const deployment = await github(`/repos/${repository}/deployments`, {
    method: "POST",
    body: JSON.stringify({
      ref,
      environment,
      auto_merge: false,
      required_contexts: [],
      description,
      production_environment: true,
      transient_environment: false
    })
  });
  const logUrl = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  await github(`/repos/${repository}/deployments/${deployment.id}/statuses`, {
    method: "POST",
    body: JSON.stringify({
      state: "in_progress",
      environment,
      log_url: logUrl,
      description: "External production mutation in progress"
    })
  });
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `deployment_id=${deployment.id}\n`);
  }
  console.log(`Started ${environment} deployment record ${deployment.id}.`);
}

async function finish() {
  const deploymentId = process.env.DEPLOYMENT_ID;
  if (!deploymentId) throw new Error("DEPLOYMENT_ID is required");
  const jobStatus = (process.env.JOB_STATUS || "failure").toLowerCase();
  const state = jobStatus === "success" ? "success" : jobStatus === "cancelled" ? "inactive" : "failure";
  const logUrl = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  await github(`/repos/${repository}/deployments/${deploymentId}/statuses`, {
    method: "POST",
    body: JSON.stringify({
      state,
      environment,
      log_url: logUrl,
      description: `External production mutation ${state}`
    })
  });
  console.log(`Finalized ${environment} deployment record ${deploymentId} as ${state}.`);
}

const command = process.argv[2];
if (command === "start") await start();
else if (command === "finish") await finish();
else throw new Error("Usage: github-deployment-record.mjs <start|finish>");
