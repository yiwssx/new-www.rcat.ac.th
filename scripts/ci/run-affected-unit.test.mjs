// @vitest-environment node

import { describe, expect, it } from "vitest";
import { selectUnitTestCommand } from "./run-affected-unit.mjs";

const verifiedPlan = {
  mode: "affected",
  gateReady: true,
  verifiedIntegration: true,
  areas: ["unit"],
  requiredLanes: ["static-quality", "unit"],
  changedPaths: ["src/test/ciVercelCompatibility.test.ts"]
};

const exists = () => true;

describe("P3 CI unit test scope selection", () => {
  it("runs only a directly modified unit test on a verified pull request", () => {
    const result = selectUnitTestCommand(verifiedPlan, "pull_request", exists);
    expect(result.mode).toBe("selected-tests");
    expect(result.args).toEqual(["scripts/run-vitest.mjs", "run", "src/test/ciVercelCompatibility.test.ts"]);
  });

  it("permits documentation to accompany existing test-file changes", () => {
    const plan = {
      ...verifiedPlan,
      areas: ["documentation", "unit"],
      changedPaths: ["docs/ci-guide.md", "src/test/ciVercelCompatibility.test.ts"]
    };
    expect(selectUnitTestCommand(plan, "pull_request", exists).mode).toBe("selected-tests");
  });

  it.each(["push", "workflow_dispatch", "merge_group"])("keeps full tests for event %s", (event) => {
    expect(selectUnitTestCommand(verifiedPlan, event, exists).mode).toBe("full");
  });

  it.each([
    { ...verifiedPlan, gateReady: false },
    { ...verifiedPlan, verifiedIntegration: false },
    { ...verifiedPlan, mode: "full" },
    { ...verifiedPlan, areas: ["unit", "public"] },
    { ...verifiedPlan, requiredLanes: ["static-quality"] },
    { ...verifiedPlan, changedPaths: [] },
    { ...verifiedPlan, changedPaths: ["src/test/setup.ts"] },
    { ...verifiedPlan, changedPaths: ["src/test/integration/content.test.ts"] },
    { ...verifiedPlan, changedPaths: ["src/public/pages/PublicNewsPage.tsx"] },
    { ...verifiedPlan, changedPaths: ["scripts/ci/impact-plan.test.mjs"] },
    { ...verifiedPlan, changedPaths: ["src/test/ciVercelCompatibility.test.ts", "src/theme.ts"] },
    { ...verifiedPlan, changedPaths: ["src/test/../server/cmsAuth/handlers.test.mjs"] }
  ])("defaults to full unit tests for broader or unverified changes: %j", (plan) => {
    expect(selectUnitTestCommand(plan, "pull_request", exists).mode).toBe("full");
  });

  it("runs the full suite if a renamed/deleted test path is absent", () => {
    expect(selectUnitTestCommand(verifiedPlan, "pull_request", () => false).mode).toBe("full");
  });

  it("avoids huge or ambiguous test-only scopes", () => {
    const manyFiles = Array.from({ length: 31 }, (_, i) => `src/test/item${i}.test.ts`);
    const plan = { ...verifiedPlan, changedPaths: manyFiles };
    expect(selectUnitTestCommand(plan, "pull_request", exists).mode).toBe("full");
  });

  it("rejects malformed plans by using the full command", () => {
    expect(selectUnitTestCommand(null, "pull_request", exists).args).toEqual(["test:unit"]);
  });
});
