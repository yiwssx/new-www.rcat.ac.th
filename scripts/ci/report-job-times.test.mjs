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


  it("reports measured E2E setup and execution steps independently of job elapsed time", () => {
    const result = summarizeJobTimings([
      {
        name: "Functional E2E",
        conclusion: "success",
        started_at: "2026-10-28T00:00:00Z",
        completed_at: "2026-10-28T00:00:20Z",
        steps: [
          {
            name: "Run ./.github/actions/setup-project",
            conclusion: "success",
            started_at: "2026-10-28T00:00:01Z",
            completed_at: "2026-10-28T00:00:04Z"
          },
          {
            name: "Run pnpm exec playwright install --with-deps chromium",
            conclusion: "success",
            started_at: "2026-10-28T00:00:04Z",
            completed_at: "2026-10-28T00:00:09Z"
          },
          {
            name: "Run changed Playwright specs when safe, or full Functional E2E",
            conclusion: "success",
            started_at: "2026-10-28T00:00:09Z",
            completed_at: "2026-10-28T00:00:20Z"
          },
          {
            name: "Complete job",
            conclusion: "success",
            started_at: "2026-10-28T00:00:20Z",
            completed_at: "2026-10-28T00:00:20Z"
          }
        ]
      }
    ]);
    expect(result.jobSeconds).toBe(20);
    expect(result.stepEntries.map((entry) => entry.seconds)).toEqual([3, 5, 11]);
    expect(formatJobTimingSummary(result, "42")).toContain(
      "| Functional E2E | Run pnpm exec playwright install --with-deps chromium | success | 5 s |"
    );
    expect(result.stepEntries).toHaveLength(3);
  });

  it("does not invent step durations for skipped or uncompleted steps", () => {
    const result = summarizeJobTimings([
      {
        name: "Governance",
        conclusion: "success",
        steps: [
          {
            name: "Run pnpm perf:check",
            conclusion: "skipped",
            started_at: "2026-10-28T00:00:00Z",
            completed_at: "2026-10-28T00:00:01Z"
          }
        ]
      }
    ]);
    expect(result.stepEntries).toHaveLength(1);
    expect(result.stepEntries[0].seconds).toBeNull();
    expect(formatJobTimingSummary(result, "42")).toContain("| Governance | Run pnpm perf:check | skipped | n/a |");
  });

  it("escapes untrusted markdown from job names", () => {
    const result = summarizeJobTimings([{ name: "Bad|name\n<script><SCRIPT>", conclusion: "failure" }]);
    const summary = formatJobTimingSummary(result, "123");
    expect(summary).not.toContain("<script>");
    expect(summary).not.toContain("<SCRIPT>");
    expect(summary).not.toContain("Bad|name");
  });
});
