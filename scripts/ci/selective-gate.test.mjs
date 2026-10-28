import { describe, expect, it } from "vitest";
import { defaultImpactMap } from "./impact-plan.mjs";
import { formatImpactOutputs, parseChangedFiles, selectCIPlan } from "./detect-impact.mjs";
import { formatQualityGateSummary, validateQualityGate } from "./quality-gate.mjs";

const BASE_SHA = "a".repeat(40);
const EVENT_SHA = "b".repeat(40);

function planFor(changes, extras = {}) {
  return selectCIPlan({
    eventName: "pull_request",
    baseSha: BASE_SHA,
    eventSha: EVENT_SHA,
    checkoutSha: EVENT_SHA,
    firstParentSha: BASE_SHA,
    changes,
    ...extras
  });
}

function laneResults(plan) {
  return Object.fromEntries(
    defaultImpactMap.lanes.map((lane) => [lane, plan.requiredLanes.includes(lane) ? "success" : "skipped"])
  );
}

describe("verified CI impact detection", () => {
  it("parses status-delimited git changes including deletions and renames", () => {
    expect(parseChangedFiles("M\0docs/a.md\0D\0docs/b.md\0R100\0docs/old.md\0src/theme.ts\0")).toEqual([
      { status: "modified", path: "docs/a.md" },
      { status: "deleted", path: "docs/b.md" },
      { status: "renamed", previousPath: "docs/old.md", path: "src/theme.ts" }
    ]);
  });

  it.each(["", "M\0", "X\0docs/a.md\0", "R99\0docs/old.md\0"])(
    "rejects malformed or unsupported git status output",
    (output) => {
      expect(() => parseChangedFiles(output)).toThrow();
    }
  );

  it("can skip unrelated lanes on a verified docs-only synthetic merge", () => {
    const plan = planFor([{ status: "modified", path: "docs/architecture/notes.md" }]);
    expect(plan.mode).toBe("affected");
    expect(plan.verifiedIntegration).toBe(true);
    expect(plan.gateReady).toBe(true);
    expect(plan.requiredLanes).toEqual(["static-quality"]);
    expect(formatImpactOutputs(plan)).toContain("require_functional=false");
    expect(validateQualityGate(plan, laneResults(plan), "success", "success", "pull_request")).toEqual([]);
  });

  it.each([{ firstParentSha: EVENT_SHA }, { checkoutSha: BASE_SHA }, { eventSha: "not-a-sha" }, { changes: [] }])(
    "fails closed for unverified integration metadata: %j",
    (override) => {
      const plan = planFor([{ path: "docs/a.md", status: "modified" }], override);
      expect(plan.mode).toBe("full");
      expect(plan.requiredLanes).toEqual(defaultImpactMap.lanes);
    }
  );

  it("always runs full checks for push main and manual executions", () => {
    for (const eventName of ["push", "workflow_dispatch", "merge_group"]) {
      const plan = selectCIPlan({ eventName });
      expect(plan.mode).toBe("full");
      expect(validateQualityGate(plan, laneResults(plan), "success", "success", eventName)).toEqual([]);
    }
  });

  it("runs full checks when CI workflow or a shared API changes", () => {
    for (const path of [".github/workflows/ci.yml", "src/types.ts", "config/ci-impact-map.json"]) {
      const plan = planFor([{ path, status: "modified" }]);
      expect(plan.mode).toBe("full");
    }
  });
});

describe("CI quality aggregation", () => {
  it("does not allow required skipped jobs", () => {
    const plan = planFor([{ path: "src/public/pages/PublicNewsPage.tsx", status: "modified" }]);
    const results = laneResults(plan);
    results.unit = "skipped";
    expect(validateQualityGate(plan, results, "success", "success", "pull_request").join(" ")).toContain(
      "unit: expected success, got skipped"
    );
  });

  it("does not allow unexpected success, failure, or cancellation on skipped jobs", () => {
    const plan = planFor([{ path: "docs/guide.md", status: "modified" }]);
    for (const status of ["success", "failure", "cancelled"]) {
      const results = laneResults(plan);
      results.functional = status;
      expect(validateQualityGate(plan, results, "success", "success", "pull_request")).not.toEqual([]);
    }
  });

  it("rejects unverified selective plans, missing detector, and missing preflight", () => {
    const plan = planFor([{ path: "docs/a.md", status: "added" }]);
    const results = laneResults(plan);
    expect(
      validateQualityGate({ ...plan, verifiedIntegration: false }, results, "success", "success", "pull_request")
    ).not.toEqual([]);
    expect(validateQualityGate(plan, results, "failure", "success", "pull_request")).not.toEqual([]);
    expect(validateQualityGate(plan, results, "success", "skipped", "pull_request")).not.toEqual([]);
  });

  it("detects tampered missing, duplicate, and unknown lanes", () => {
    const plan = planFor([{ path: "docs/a.md", status: "modified" }]);
    const results = laneResults(plan);
    for (const modified of [
      { ...plan, requiredLanes: [] },
      { ...plan, requiredLanes: ["static-quality", "static-quality"] },
      { ...plan, skippedLanes: [...plan.skippedLanes, "invented"] },
      { ...plan, reasons: [] }
    ]) {
      expect(validateQualityGate(modified, results, "success", "success", "pull_request")).not.toEqual([]);
    }
  });

  it("rejects selective execution on a main push", () => {
    const plan = planFor([{ path: "docs/a.md", status: "modified" }]);
    expect(validateQualityGate(plan, laneResults(plan), "success", "success", "push")).not.toEqual([]);
  });
});

describe("CI quality report evidence", () => {
  it("records planned and observed statuses and reasons for successful selective CI", () => {
    const plan = planFor([{ path: "docs/guide.md", status: "modified" }]);
    const summary = formatQualityGateSummary({
      plan,
      results: laneResults(plan),
      impactStatus: "success",
      preflightStatus: "success",
      eventName: "pull_request",
      errors: []
    });
    expect(summary).toContain("Verdict: **PASS**");
    expect(summary).toContain("| static-quality | success | success | yes |");
    expect(summary).toContain("| functional | skipped | skipped | yes |");
    expect(summary).toContain("docs/guide.md");
  });

  it("reports a failed lane as a mismatch and does not hide validation errors", () => {
    const plan = planFor([{ path: "src/public/pages/PublicNewsPage.tsx", status: "modified" }]);
    const results = laneResults(plan);
    results.functional = "cancelled";
    const errors = validateQualityGate(plan, results, "success", "success", "pull_request");
    const summary = formatQualityGateSummary({
      plan,
      results,
      impactStatus: "success",
      preflightStatus: "success",
      eventName: "pull_request",
      errors
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(summary).toContain("Verdict: **FAIL**");
    expect(summary).toContain("| functional | success | cancelled | NO |");
    expect(summary).toContain("Gate failures");
  });

  it("sanitizes untrusted reason content in markdown tables and summaries", () => {
    const plan = planFor([{ path: "docs/guide.md", status: "modified" }]);
    const summary = formatQualityGateSummary({
      plan: { ...plan, reasons: ["untrusted|cell\n<script>"], verifiedIntegration: false },
      results: laneResults(plan),
      impactStatus: "failure",
      preflightStatus: "success",
      eventName: "pull_request",
      errors: ["Impact detector did not succeed"]
    });
    expect(summary).not.toContain("<script>");
    expect(summary).not.toContain("untrusted|cell");
    expect(summary).toContain("Verdict: **FAIL**");
  });
});
