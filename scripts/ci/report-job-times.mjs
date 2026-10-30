import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { formatWorkflowHistorySummary, readWorkflowHistory } from "./history-trends.mjs";

const OBSERVED_STEPS = new Map([
  [
    "Functional E2E",
    new Set([
      "Run ./.github/actions/setup-project",
      "Validate production Playwright suite discovery",
      "Run pnpm exec playwright install --with-deps chromium",
      "Run changed Playwright specs when safe, or full Functional E2E"
    ])
  ],
  ["Governance", new Set(["Run pnpm perf:check"])]
]);

function safeLabel(value) {
  return String(value ?? "unnamed")
    .replace(/[\r\n|<>`]/g, " ")
    .slice(0, 120);
}

export function summarizeJobTimings(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error("GitHub returned no workflow jobs");
  }

  const entries = jobs
    .filter((job) => job.name !== "quality")
    .map((job) => {
      const start = Date.parse(job.started_at ?? "");
      const end = Date.parse(job.completed_at ?? "");
      const timed = Number.isFinite(start) && Number.isFinite(end) && end >= start;
      return {
        name: safeLabel(job.name).slice(0, 80),
        conclusion: String(job.conclusion ?? job.status ?? "unknown"),
        seconds: timed ? Math.ceil((end - start) / 1000) : null,
        start: timed ? start : null,
        end: timed ? end : null
      };
    });

  const stepEntries = jobs.flatMap((job) => {
    const observed = OBSERVED_STEPS.get(job.name);
    if (!observed || !Array.isArray(job.steps)) return [];
    return job.steps
      .filter((step) => observed.has(step.name))
      .map((step) => {
        const start = Date.parse(step.started_at ?? "");
        const end = Date.parse(step.completed_at ?? "");
        const timed = step.conclusion !== "skipped" && Number.isFinite(start) && Number.isFinite(end) && end >= start;
        return {
          job: safeLabel(job.name),
          step: safeLabel(step.name),
          conclusion: safeLabel(step.conclusion ?? step.status ?? "unknown"),
          seconds: timed ? Math.ceil((end - start) / 1000) : null
        };
      });
  });

  const measured = entries.filter((entry) => entry.seconds !== null);
  const earliest = measured.length > 0 ? Math.min(...measured.map((entry) => entry.start)) : null;
  const latest = measured.length > 0 ? Math.max(...measured.map((entry) => entry.end)) : null;

  return {
    entries,
    stepEntries,
    jobSeconds: measured.reduce((sum, entry) => sum + entry.seconds, 0),
    wallSeconds: earliest === null ? null : Math.ceil((latest - earliest) / 1000),
    measuredJobs: measured.length
  };
}

export function formatJobTimingSummary(result, runId) {
  const lines = [
    "### RCAT CI job timing evidence",
    "",
    `- Run: ${String(runId)}`,
    `- Measured upstream jobs: ${result.measuredJobs}`,
    `- Elapsed wall clock (first upstream start to last finish): ${result.wallSeconds ?? "unknown"} s`,
    `- Sum of job elapsed times (not billed runner minutes): ${result.jobSeconds} s`,
    "",
    "| Job | Result | Elapsed |",
    "| --- | --- | ---: |"
  ];

  for (const entry of result.entries) {
    const time = entry.seconds === null ? "n/a" : `${entry.seconds} s`;
    lines.push(`| ${entry.name} | ${entry.conclusion} | ${time} |`);
  }

  if (result.stepEntries?.length > 0) {
    lines.push(
      "",
      "#### Observed setup and test steps (GitHub Actions step elapsed time)",
      "",
      "| Job | Step | Result | Elapsed |",
      "| --- | --- | --- | ---: |"
    );
    for (const step of result.stepEntries) {
      const time = step.seconds === null ? "n/a" : `${step.seconds} s`;
      lines.push(`| ${step.job} | ${step.step} | ${step.conclusion} | ${time} |`);
    }
    lines.push("", "Step elapsed durations do not represent billed runner minutes or guaranteed cache savings.");
  }

  lines.push("", "Skipped and uncompleted jobs are not assigned invented runtimes.");
  return lines.join("\n") + "\n";
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const runId = process.env.GITHUB_RUN_ID ?? "";
  const token = process.env.GITHUB_TOKEN ?? "";
  const summaryFile = process.env.GITHUB_STEP_SUMMARY ?? "";

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^\d+$/.test(runId)) {
    throw new Error("Untrusted or unavailable GitHub run coordinates");
  }
  if (!token || !summaryFile) {
    throw new Error("GitHub token or summary file unavailable");
  }

  const url = `https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`GitHub Actions jobs read failed (HTTP ${response.status})`);
  }

  const payload = await response.json();
  if (payload.total_count > 100) {
    throw new Error("Job list is paginated; refuse to publish incomplete metrics");
  }

  const result = summarizeJobTimings(payload.jobs);
  appendFileSync(summaryFile, formatJobTimingSummary(result, runId));
  console.log(
    "RCAT CI job timings recorded:",
    JSON.stringify({
      measuredJobs: result.measuredJobs,
      jobSeconds: result.jobSeconds,
      wallSeconds: result.wallSeconds
    })
  );

  // Historical comparisons are optional telemetry; a GitHub API error must not
  // turn a passing/failing required quality gate into an unrelated verdict.
  try {
    const trends = await readWorkflowHistory(repository, token, runId);
    appendFileSync(summaryFile, formatWorkflowHistorySummary(trends));
    console.log("RCAT CI lifecycle cohorts recorded:", JSON.stringify(trends));
  } catch (error) {
    console.warn("Non-blocking CI history telemetry:", error instanceof Error ? error.message : String(error));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Non-blocking CI timing telemetry:", error instanceof Error ? error.message : String(error));
    // Optional telemetry cannot override the required quality gate.
  });
}
