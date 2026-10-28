// @vitest-environment node

import { describe, expect, it } from "vitest";
import { selectFunctionalTestCommand } from "./run-affected-functional.mjs";

const verifiedPlan = {
  mode: "affected",
  gateReady: true,
  verifiedIntegration: true,
  areas: ["functional"],
  requiredLanes: ["static-quality", "functional"],
  changedPaths: ["tests/functional/designSystemUiUx.spec.ts"]
};

const exists = () => true;

describe("P3 functional E2E scope selection", () => {
  it("runs a directly edited Playwright spec only for a verified PR", () => {
    const result = selectFunctionalTestCommand(verifiedPlan, "pull_request", exists);
    expect(result.mode).toBe("selected-specs");
    expect(result.args).toEqual(["exec", "playwright", "test", "tests/functional/designSystemUiUx.spec.ts"]);
  });

  it("permits docs alongside existing Playwright spec edits", () => {
    const plan = {
      ...verifiedPlan,
      areas: ["documentation", "functional"],
      changedPaths: ["docs/ci-guide.md", "tests/functional/designSystemUiUx.spec.ts"]
    };
    expect(selectFunctionalTestCommand(plan, "pull_request", exists).mode).toBe("selected-specs");
  });

  it("sorts several modified specs deterministically", () => {
    const plan = {
      ...verifiedPlan,
      changedPaths: ["tests/functional/publicCookieConsent.spec.ts", "tests/functional/designSystemUiUx.spec.ts"]
    };
    expect(selectFunctionalTestCommand(plan, "pull_request", exists).args.slice(3)).toEqual([
      "tests/functional/designSystemUiUx.spec.ts",
      "tests/functional/publicCookieConsent.spec.ts"
    ]);
  });

  it.each(["push", "workflow_dispatch", "merge_group"])("always retains full E2E for event %s", (eventName) => {
    expect(selectFunctionalTestCommand(verifiedPlan, eventName, exists).mode).toBe("full");
  });

  it.each([
    { ...verifiedPlan, mode: "full" },
    { ...verifiedPlan, gateReady: false },
    { ...verifiedPlan, verifiedIntegration: false },
    { ...verifiedPlan, areas: ["public", "functional"] },
    { ...verifiedPlan, requiredLanes: ["static-quality"] },
    { ...verifiedPlan, changedPaths: [] },
    { ...verifiedPlan, changedPaths: ["tests/functional/fixtures/publicAuthIsolationFixture.ts"] },
    { ...verifiedPlan, changedPaths: ["tests/production/production.smoke.pw.ts"] },
    { ...verifiedPlan, changedPaths: ["playwright.config.ts"] },
    { ...verifiedPlan, changedPaths: ["src/public/pages/PublicHomePage.tsx"] },
    { ...verifiedPlan, changedPaths: ["tests/functional/designSystemUiUx.spec.ts", "src/theme.ts"] },
    { ...verifiedPlan, changedPaths: ["tests/functional/../../server/unsafe.spec.ts"] }
  ])("falls back to full E2E for unsafe or broader impacts: %j", (plan) => {
    expect(selectFunctionalTestCommand(plan, "pull_request", exists).mode).toBe("full");
  });

  it("falls back to full E2E when a changed spec does not exist or is symlinked", () => {
    expect(selectFunctionalTestCommand(verifiedPlan, "pull_request", () => false).mode).toBe("full");
  });

  it("limits very large test-only modifications", () => {
    const plan = {
      ...verifiedPlan,
      changedPaths: Array.from({ length: 21 }, (_, i) => `tests/functional/case${i}.spec.ts`)
    };
    expect(selectFunctionalTestCommand(plan, "pull_request", exists).mode).toBe("full");
  });
});
