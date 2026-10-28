import { describe, expect, it } from "vitest";
import { formatJobTimingSummary, summarizeJobTimings } from "./report-job-times.mjs";

describe("CI job timing evidence", () => {
  it("calculates concurrent wall time separately from total job time", () => {
    const result = summarizeJobTimings([
      {
        name: "Change Impact",
        conclusion: "success",
        started_at: "2026-10-28T00:00:00Z",
        completed_at: "2026-10-28T00:00:10Z"
      },
      {
        name: "Functional E2E",
        conclusion: "success",
        started_at: "2026-10-28T00:00:05Z",
        completed_at: "2026-10-28T00:00:20Z"
      },
      { name: "Worker", conclusion: "skipped", started_at: null, completed_at: null },
      {
        name: "quality",
        conclusion: "in_progress",
        started_at: "2026-10-28T00:00:22Z",
        completed_at: null
      }
    ]);

    expect(result.measuredJobs).toBe(2);
    expect(result.jobSeconds).toBe(25);
    expect(result.wallSeconds).toBe(20);
    expect(result.entries).toHaveLength(3);
    expect(result.entries[2].seconds).toBeNull();
    const report = formatJobTimingSummary(result, "123");
    expect(report).toMatch(/Measured upstream jobs: 2/);
    expect(report).toMatch(/Sum of job elapsed times \(not billed runner minutes\): 25 s/);
    expect(report).toMatch(/\| Worker \| skipped \| n\/a \|/);
    expect(report).not.toMatch(/\| quality \|/);
  });

  it("rejects missing job metadata instead of inventing numbers", () => {
    expect(() => summarizeJobTimings([])).toThrow(/no workflow jobs/);
    const result = summarizeJobTimings([{ name: "Build", started_at: "bad", completed_at: "bad" }]);
    expect(result.wallSeconds).toBeNull();
    expect(result.jobSeconds).toBe(0);
  });

  it("escapes untrusted markdown from job names", () => {
    const result = summarizeJobTimings([{ name: "Bad|name\n<script>", conclusion: "failure" }]);
    const summary = formatJobTimingSummary(result, "123");
    expect(summary).not.toMatch(/<script>/);
    expect(summary).not.toMatch(/Bad\|name/);
  });
});
