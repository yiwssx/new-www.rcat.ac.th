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

  it("accepts only trusted documentation-only main push ranges", () => {
    const inputs = {
      eventName: "push",
      beforeSha: BASE_SHA,
      eventSha: EVENT_SHA,
      checkoutSha: EVENT_SHA,
      pushRef: "refs/heads/main",
      verifiedAncestor: true,
      changes: [{ status: "modified", path: "README.md" }],
      fileIsRegular: () => true
    };
    const docs = selectCIPlan(inputs);
    expect(docs.mode).toBe("affected");
    expect(docs.requiredLanes).toEqual(["static-quality"]);
    expect(validateQualityGate(docs, laneResults(docs), "success", "success", "push")).toEqual([]);

    const source = selectCIPlan({
      ...inputs,
      changes: [{ status: "modified", path: "src/types.ts" }]
    });
    expect(source.mode).toBe("full");
    expect(selectCIPlan({ ...inputs, verifiedAncestor: false }).mode).toBe("full");
    expect(selectCIPlan({ ...inputs, beforeSha: EVENT_SHA }).mode).toBe("full");
    expect(selectCIPlan({ ...inputs, fileIsRegular: () => false }).mode).toBe("full");

    const forged = { ...docs, verifiedPush: false };
    expect(validateQualityGate(forged, laneResults(docs), "success", "success", "push")).not.toEqual([]);
  });

  it("uses frontend-only lanes for an allowlisted main source change", () => {
    const input = {
      eventName: "push",
      beforeSha: BASE_SHA,
      eventSha: EVENT_SHA,
      checkoutSha: EVENT_SHA,
      pushRef: "refs/heads/main",
      verifiedAncestor: true,
      fileIsRegular: () => true
    };
    const frontend = selectCIPlan({
      ...input,
      changes: [{ status: "modified", path: "src/public/pages/PublicNewsPage.tsx" }]
    });
    expect(frontend.mode).toBe("affected");
    expect(frontend.requiredLanes).not.toContain("worker");
    expect(frontend.requiredLanes).toContain("functional");
    expect(validateQualityGate(frontend, laneResults(frontend), "success", "success", "push")).toEqual([]);

    const backend = selectCIPlan({
      ...input,
      changes: [{ status: "modified", path: "cloudflare/public-api/src/db/d1QueryUsage.ts" }]
    });
    expect(backend.mode).toBe("affected");
    expect(backend.requiredLanes).toContain("worker");
    expect(backend.requiredLanes).not.toContain("functional");
    expect(validateQualityGate(backend, laneResults(backend), "success", "success", "push")).toEqual([]);
  });

  it("expands backend API and mixed main source changes to frontend consumers", () => {
    const plan = selectCIPlan({
      eventName: "push",
      beforeSha: BASE_SHA,
      eventSha: EVENT_SHA,
      checkoutSha: EVENT_SHA,
      pushRef: "refs/heads/main",
      verifiedAncestor: true,
      fileIsRegular: () => true,
      changes: [
        { status: "added", path: "src/public/pages/PublicNewsPage.tsx" },
        { status: "modified", path: "cloudflare/public-api/src/routes/publicHome.ts" }
      ]
    });
    expect(plan.mode).toBe("affected");
    expect(plan.requiredLanes).toContain("worker");
    expect(plan.requiredLanes).toContain("functional");
    expect(validateQualityGate(plan, laneResults(plan), "success", "success", "push")).toEqual([]);
  });

  it("keeps full main CI for unsafe CRUD, auth, schema and deleted sources", () => {
    const input = {
      eventName: "push",
      beforeSha: BASE_SHA,
      eventSha: EVENT_SHA,
      checkoutSha: EVENT_SHA,
      pushRef: "refs/heads/main",
      verifiedAncestor: true,
      fileIsRegular: () => true
    };
    for (const path of [
      "cloudflare/public-api/src/auth/adminAccess.ts",
      "cloudflare/public-api/src/db/schema.ts",
      "cloudflare/public-api/migrations/0001_example.sql",
      "src/types.ts"
    ]) {
      const plan = selectCIPlan({ ...input, changes: [{ status: "modified", path }] });
      expect(plan.mode).toBe("full");
    }
    const deleted = selectCIPlan({
      ...input,
      changes: [{ status: "deleted", path: "src/public/pages/PublicNewsPage.tsx" }]
    });
    expect(deleted.mode).toBe("full");
  });

  it("rejects tampering with main source ownership and planned lanes", () => {
    const original = selectCIPlan({
      eventName: "push",
      beforeSha: BASE_SHA,
      eventSha: EVENT_SHA,
      checkoutSha: EVENT_SHA,
      pushRef: "refs/heads/main",
      verifiedAncestor: true,
      changes: [{ status: "modified", path: "src/public/pages/PublicNewsPage.tsx" }],
      fileIsRegular: () => true
    });
    for (const altered of [
      { ...original, changedEntries: [{ status: "modified", path: "src/types.ts" }] },
      { ...original, changedPaths: ["src/shared/secret.ts"] },
      { ...original, verifiedPush: false },
      { ...original, requiredLanes: ["static-quality"] },
      { ...original, reasons: [] }
    ]) {
      expect(validateQualityGate(altered, laneResults(original), "success", "success", "push")).not.toEqual([]);
    }
  });

  it("accepts an identical-tree FULL PR E2E reuse only with traceable evidence", () => {
    const main = selectCIPlan({
      eventName: "push",
      beforeSha: BASE_SHA,
      eventSha: EVENT_SHA,
      checkoutSha: EVENT_SHA,
      pushRef: "refs/heads/main",
      verifiedAncestor: true,
      changes: [{ status: "modified", path: "src/public/pages/PublicNewsPage.tsx" }],
      fileIsRegular: () => true
    });
    const evidence = {
      mainSha: EVENT_SHA,
      beforeSha: BASE_SHA,
      treeSha: "c".repeat(40),
      prNumber: 793,
      prHeadSha: "d".repeat(40),
      prRunId: 44457051682,
      runAttempt: 1,
      e2eJobId: 135334848910,
      qualityJobId: 135336876762
    };
    const reused = {
      ...main,
      requiredLanes: main.requiredLanes.filter((lane) => lane !== "functional"),
      skippedLanes: [...main.skippedLanes, "functional"],
      reasons: [...main.reasons, "reused-pr-full-e2e-identical-tree"],
      reuseFunctional: evidence
    };
    expect(validateQualityGate(reused, laneResults(reused), "success", "success", "push")).toEqual([]);
    for (const forged of [
      { ...reused, reuseFunctional: { ...evidence, mainSha: BASE_SHA } },
      { ...reused, reuseFunctional: { ...evidence, treeSha: "invalid" } },
      { ...reused, reuseFunctional: { ...evidence, prRunId: 0 } },
      { ...reused, reasons: main.reasons },
      { ...reused, requiredLanes: ["static-quality"] },
      { ...reused, skippedLanes: main.skippedLanes }
    ]) {
      expect(validateQualityGate(forged, laneResults(reused), "success", "success", "push")).not.toEqual([]);
    }
    const report = formatQualityGateSummary({
      plan: reused,
      results: laneResults(reused),
      impactStatus: "success",
      preflightStatus: "success",
      eventName: "push",
      errors: []
    });
    expect(report).toContain("REUSED");
    expect(report).toContain("44457051682");
  });

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
