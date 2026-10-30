// Read-only trend evidence. This is never a release gate and never changes which tests execute.
const COHORTS = ["pull_request", "push"];
const MIN_SAMPLE_SIZE = 5;
const MAX_COHORT_RUNS = 25;

export function percentileSeconds(values, percentile) {
  if (!Array.isArray(values) || !values.length || !Number.isFinite(percentile) || percentile < 0 || percentile > 1) {
    throw new Error("Invalid percentile sample");
  }
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Invalid duration sample");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * percentile;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower));
}

function elapsedSeconds(run) {
  const start = Date.parse(run.created_at ?? "");
  const end = Date.parse(run.updated_at ?? "");
  const elapsed = (end - start) / 1000;
  return Number.isFinite(start) && Number.isFinite(end) && elapsed >= 0 && elapsed < 7200 ? Math.ceil(elapsed) : null;
}

export function summarizeWorkflowHistory(runs, excludedRunId = "") {
  if (!Array.isArray(runs)) throw new Error("GitHub Actions history must be an array");

  const byEvent = Object.fromEntries(COHORTS.map((event) => [event, []]));
  const eligible = runs.filter(
    (run) =>
      run?.name === "CI" &&
      COHORTS.includes(run.event) &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      (run.run_attempt ?? 1) === 1 &&
      String(run.id) !== String(excludedRunId) &&
      (run.event !== "push" || run.head_branch === "main") &&
      elapsedSeconds(run) !== null
  );

  eligible.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const run of eligible) {
    const group = byEvent[run.event];
    if (group.length < MAX_COHORT_RUNS) group.push(elapsedSeconds(run));
  }

  return Object.fromEntries(
    COHORTS.map((event) => {
      const samples = byEvent[event];
      return [
        event,
        {
          count: samples.length,
          p50Seconds: samples.length >= MIN_SAMPLE_SIZE ? percentileSeconds(samples, 0.5) : null,
          p90Seconds: samples.length >= MIN_SAMPLE_SIZE ? percentileSeconds(samples, 0.9) : null
        }
      ];
    })
  );
}

export function formatWorkflowHistorySummary(trends) {
  const lines = [
    "### Recent GitHub Actions CI lifecycle trends",
    "",
    "Successful first-attempt CI runs only; separate PR and push-to-main cohorts.",
    "Lifecycle seconds = GitHub run updated_at minus created_at, including queue; not runner billable time.",
    "Most recent up to 100 Actions runs (all workflow types); at most 25 samples per cohort.",
    "Cancelled, failed, retried, pending, and implausible timestamps are excluded.",
    "Source-code and docs-only PRs are **not** separately identifiable in this sample.",
    "",
    "| Event | Successful samples | P50 lifecycle | P90 lifecycle |",
    "| --- | ---: | ---: | ---: |"
  ];
  for (const event of COHORTS) {
    const item = trends[event];
    const p50 = item.p50Seconds === null ? "n/a (<5 runs)" : item.p50Seconds + " s";
    const p90 = item.p90Seconds === null ? "n/a (<5 runs)" : item.p90Seconds + " s";
    lines.push("| " + event + " | " + item.count + " | " + p50 + " | " + p90 + " |");
  }
  lines.push(
    "",
    "This is descriptive evidence only, not billed runner-minutes, a causal speed-up estimate,",
    "or a justification to skip browser, security, Worker, or push-main checks."
  );
  return lines.join("\n") + "\n";
}

export async function readWorkflowHistory(repository, token, runId, request = fetch) {
  const response = await request("https://api.github.com/repos/" + repository + "/actions/runs?per_page=100", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error("Historical Actions runs read failed (HTTP " + response.status + ")");
  const payload = await response.json();
  if (!Array.isArray(payload.workflow_runs)) throw new Error("GitHub returned no valid workflow run history");
  return summarizeWorkflowHistory(payload.workflow_runs, runId);
}
