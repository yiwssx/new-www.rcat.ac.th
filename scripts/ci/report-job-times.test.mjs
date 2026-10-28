import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

    assert.equal(result.measuredJobs, 2);
    assert.equal(result.jobSeconds, 25);
    assert.equal(result.wallSeconds, 20);
    assert.equal(result.entries.length, 3);
    assert.equal(result.entries[2].seconds, null);
    const report = formatJobTimingSummary(result, "123");
    assert.match(report, /Measured upstream jobs: 2/);
    assert.match(report, /Sum of job elapsed times \(not billed runner minutes\): 25 s/);
    assert.match(report, /\| Worker \| skipped \| n\/a \|/);
    assert.doesNotMatch(report, /\| quality \|/);
  });

  it("rejects missing job metadata instead of inventing numbers", () => {
    assert.throws(() => summarizeJobTimings([]), /no workflow jobs/);
    const result = summarizeJobTimings([{ name: "Build", started_at: "bad", completed_at: "bad" }]);
    assert.equal(result.wallSeconds, null);
    assert.equal(result.jobSeconds, 0);
  });

  it("escapes untrusted markdown from job names", () => {
    const result = summarizeJobTimings([{ name: "Bad|name\n<script>", conclusion: "failure" }]);
    const summary = formatJobTimingSummary(result, "123");
    assert.doesNotMatch(summary, /<script>/);
    assert.doesNotMatch(summary, /Bad\|name/);
  });
});
