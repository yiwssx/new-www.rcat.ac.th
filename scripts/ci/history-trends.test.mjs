// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  formatWorkflowHistorySummary,
  percentileSeconds,
  readWorkflowHistory,
  summarizeWorkflowHistory
} from "./history-trends.mjs";

function run(event, seconds, number, overrides = {}) {
  const created = new Date(Date.UTC(2026, 9, 28, 12, number, 0));
  return {
    id: number,
    name: "CI",
    event,
    head_branch: event === "push" ? "main" : "feature/test",
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
    created_at: created.toISOString(),
    updated_at: new Date(created.getTime() + seconds * 1000).toISOString(),
    ...overrides
  };
}

describe("historical CI timing cohort statistics", () => {
  it("computes interpolated P50 and P90 without changing the supplied data", () => {
    const values = [50, 10, 40, 30, 20];
    expect(percentileSeconds(values, 0.5)).toBe(30);
    expect(percentileSeconds(values, 0.9)).toBe(46);
    expect(values).toEqual([50, 10, 40, 30, 20]);
    expect(percentileSeconds([10, 30], 0.5)).toBe(20);
  });

  it("separates successful PR and main-push samples and excludes the current run", () => {
    const runs = [
      ...[100, 200, 300, 400, 500].map((n, i) => run("pull_request", n, i + 1)),
      ...[150, 250, 350, 450, 550, 650].map((n, i) => run("push", n, i + 20)),
      run("push", 500, 100, { head_branch: "develop" }),
      run("pull_request", 5000, 101, { conclusion: "failure" }),
      run("push", 2000, 102, { status: "in_progress" }),
      run("push", 2000, 103, { run_attempt: 2 }),
      run("push", 2000, 104, { name: "Production Verification" }),
      run("push", 2000, 105, { updated_at: null }),
      run("push", 2000, 106, { updated_at: "2026-10-29T14:59:00Z" })
    ];
    const trends = summarizeWorkflowHistory(runs, 25);
    expect(trends.pull_request).toEqual({ count: 5, p50Seconds: 300, p90Seconds: 460 });
    expect(trends.push).toEqual({ count: 5, p50Seconds: 350, p90Seconds: 510 });
    const report = formatWorkflowHistorySummary(trends);
    expect(report).toContain("| pull_request | 5 | 300 s | 460 s |");
    expect(report).toContain("| push | 5 | 350 s | 510 s |");
    expect(report).toContain("not runner billable time");
  });

  it("requires adequate sample sizes and rejects invalid durations and inputs", () => {
    expect(summarizeWorkflowHistory([run("push", 300, 1)]).push).toEqual({
      count: 1,
      p50Seconds: null,
      p90Seconds: null
    });
    expect(formatWorkflowHistorySummary(summarizeWorkflowHistory([]))).toContain("n/a (<5 runs)");
    expect(summarizeWorkflowHistory([run("push", 300, 1, { updated_at: "bad" })]).push.count).toBe(0);
    expect(() => summarizeWorkflowHistory(null)).toThrow("must be an array");
    expect(() => percentileSeconds([], 0.5)).toThrow();
    expect(() => percentileSeconds([-1], 0.5)).toThrow();
    expect(() => percentileSeconds([1], 2)).toThrow();
  });

  it("caps samples to most recent 25 runs per cohort", () => {
    const runs = Array.from({ length: 30 }, (_, i) => run("pull_request", 50 + i, i + 1));
    expect(summarizeWorkflowHistory(runs).pull_request.count).toBe(25);
  });

  it("reads only a GitHub Actions runs list and validates the response", async () => {
    const requests = [];
    const request = async (url, init) => {
      requests.push({ url, init });
      return { ok: true, json: async () => ({ workflow_runs: [run("push", 100, 1)] }) };
    };
    expect((await readWorkflowHistory("owner/repo", "secret", 2, request)).push.count).toBe(1);
    expect(requests[0].url).toBe("https://api.github.com/repos/owner/repo/actions/runs?per_page=100");
    expect(requests[0].init.headers.Authorization).toBe("Bearer secret");
    await expect(
      readWorkflowHistory("owner/repo", "secret", 2, async () => ({ ok: false, status: 403 }))
    ).rejects.toThrow("HTTP 403");
    await expect(
      readWorkflowHistory("owner/repo", "secret", 2, async () => ({ ok: true, json: async () => ({}) }))
    ).rejects.toThrow("no valid workflow run history");
  });
});
