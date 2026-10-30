// @vitest-environment node

import { describe, expect, it } from "vitest";
import { formatCanaryResult, selectCanary } from "./dual-run-functional-canary.mjs";

const verified = {
  mode: "affected",
  gateReady: true,
  verifiedIntegration: true,
  changedPaths: ["src/public/utils/homeCarouselInteraction.ts"],
  requiredLanes: ["static-quality", "unit", "build", "governance", "functional"]
};
const branch = "ci/782-carousel-source-canary";
const exists = () => true;

describe("#782 isolated source-change Playwright canary", () => {
  it("allows one specific source change on its dedicated PR branch", () => {
    const choice = selectCanary(verified, "pull_request", branch, exists);
    expect(choice).toEqual({
      enabled: true,
      reason: "verified-single-source-canary",
      specs: ["tests/functional/carousel.spec.ts"]
    });
    const report = formatCanaryResult(choice, 0);
    expect(report).toContain("Candidate exit status: 0");
    expect(report).toContain("Full Functional E2E must run after");
    expect(report).toContain("cannot prove coverage completeness");
  });

  it.each(["push", "workflow_dispatch", "merge_group"])("never executes on %s", (event) => {
    expect(selectCanary(verified, event, branch, exists).enabled).toBe(false);
  });

  it("rejects every unrelated branch", () => {
    for (const head of ["main", "ci/782-e2e-dualrun-canary-setup", "some-branch", undefined]) {
      expect(selectCanary(verified, "pull_request", head, exists).enabled).toBe(false);
    }
  });

  it.each([
    { ...verified, mode: "full" },
    { ...verified, verifiedIntegration: false },
    { ...verified, gateReady: false },
    { ...verified, changedPaths: [] },
    { ...verified, changedPaths: ["src/public/utils/homeCarouselInteraction.ts", "docs/readme.md"] },
    { ...verified, changedPaths: ["src/public/components/PublicHomeCarousel.tsx"] },
    { ...verified, requiredLanes: ["unit"] },
    null
  ])("fails closed for broad, missing or tampered plans: %j", (plan) => {
    expect(selectCanary(plan, "pull_request", branch, exists).enabled).toBe(false);
  });

  it("rejects files that are missing, deleted or symlinked", () => {
    expect(selectCanary(verified, "pull_request", branch, () => false).enabled).toBe(false);
    expect(
      selectCanary(verified, "pull_request", branch, (path) => path !== "tests/functional/carousel.spec.ts").enabled
    ).toBe(false);
  });

  it("makes candidate failure visible without representing it as overall success", () => {
    const choice = selectCanary(verified, "pull_request", branch, exists);
    expect(formatCanaryResult(choice, 1)).toContain("Candidate exit status: 1");
    expect(formatCanaryResult(choice, null)).toContain("Candidate exit status: unknown");
  });
});
