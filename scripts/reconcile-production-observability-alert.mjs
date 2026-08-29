import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { formatD1UsageMarkdown } from "./check-production-d1-usage.mjs";

const ALERT_TITLE = "[P6A] D1 usage alert";

function requireValue(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function shouldAlert(severity) {
  return severity === "warning" || severity === "critical";
}

async function githubRequest({ token, repo, path, method = "GET", body, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${method} ${path} failed with HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function reconcileAlert({ report, token, repo, runUrl, fetchImpl = fetch }) {
  const issues = await githubRequest({
    token,
    repo,
    path: "/issues?state=open&per_page=100",
    fetchImpl
  });
  const openAlert = Array.isArray(issues)
    ? issues.find((issue) => issue?.title === ALERT_TITLE && !issue?.pull_request)
    : undefined;

  const reportBody = [
    formatD1UsageMarkdown(report),
    `Workflow run: ${runUrl}`,
    "",
    "This issue is maintained automatically by the P6A Production Observability workflow."
  ].join("\n");

  if (shouldAlert(report.severity)) {
    if (openAlert?.number) {
      await githubRequest({
        token,
        repo,
        path: `/issues/${openAlert.number}`,
        method: "PATCH",
        body: { body: reportBody },
        fetchImpl
      });
      return { action: "updated", issueNumber: openAlert.number };
    }

    const created = await githubRequest({
      token,
      repo,
      path: "/issues",
      method: "POST",
      body: {
        title: ALERT_TITLE,
        body: reportBody
      },
      fetchImpl
    });
    return { action: "created", issueNumber: created?.number ?? null };
  }

  if (openAlert?.number) {
    const recoveryBody = [
      formatD1UsageMarkdown(report),
      `Workflow run: ${runUrl}`,
      "",
      "Usage returned below the warning threshold; this alert is being closed automatically."
    ].join("\n");
    await githubRequest({
      token,
      repo,
      path: `/issues/${openAlert.number}`,
      method: "PATCH",
      body: {
        body: recoveryBody,
        state: "closed",
        state_reason: "completed"
      },
      fetchImpl
    });
    return { action: "closed", issueNumber: openAlert.number };
  }

  return { action: "none", issueNumber: null };
}

export async function runCli(env = process.env) {
  const reportPath = requireValue(env.D1_USAGE_REPORT_PATH || "production-observability-report.json", "D1 usage report path");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const token = requireValue(env.GITHUB_TOKEN, "GITHUB_TOKEN");
  const repo = requireValue(env.GITHUB_REPOSITORY, "GITHUB_REPOSITORY");
  const serverUrl = requireValue(env.GITHUB_SERVER_URL || "https://github.com", "GITHUB_SERVER_URL");
  const runId = requireValue(env.GITHUB_RUN_ID, "GITHUB_RUN_ID");
  const runUrl = `${serverUrl}/${repo}/actions/runs/${runId}`;
  const result = await reconcileAlert({ report, token, repo, runUrl });
  console.log(`D1 usage alert reconciliation: ${result.action}${result.issueNumber ? ` #${result.issueNumber}` : ""}`);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
