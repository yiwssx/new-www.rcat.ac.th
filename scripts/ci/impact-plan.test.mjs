import { describe, expect, it } from "vitest";
import { createImpactPlan, defaultImpactMap } from "./impact-plan.mjs";

describe("CI impact plan classifier", () => {
  it("keeps documentation-only changes away from E2E, Worker, and Build lanes", () => {
    const plan = createImpactPlan(["docs/architecture/example.md"]);
    expect(plan.mode).toBe("affected");
    expect(plan.gateReady).toBe(false);
    expect(plan.requiredLanes).toEqual(["static-quality"]);
    expect(plan.skippedLanes).toContain("functional");
    expect(plan.skippedLanes).toContain("worker");
    expect(plan.skippedLanes).toContain("build");
  });

  it("checks both public and admin visuals for a theme change", () => {
    const plan = createImpactPlan(["src/theme.ts"]);
    expect(plan.mode).toBe("affected");
    expect(plan.areas).toEqual(["admin", "design", "public"]);
    expect(plan.requiredLanes).toContain("functional");
    expect(plan.requiredLanes).not.toContain("worker");
    expect(plan.requiredLanes).not.toContain("dependencies");
  });

  it("uses Public lanes for a news page modification", () => {
    const plan = createImpactPlan(["src/public/pages/PublicNewsPage.tsx"]);
    expect(plan.areas).toEqual(["public"]);
    expect(plan.requiredLanes).toContain("unit");
    expect(plan.requiredLanes).toContain("build");
    expect(plan.requiredLanes).not.toContain("worker");
  });

  it("retains security and integration coverage for auth changes", () => {
    const plan = createImpactPlan(["server/cmsAuth/protocol.mjs"]);
    expect(plan.mode).toBe("affected");
    expect(plan.areas).toContain("auth");
    expect(plan.requiredLanes).toContain("integration");
    expect(plan.requiredLanes).toContain("governance");
    expect(plan.requiredLanes).toContain("functional");
    expect(createImpactPlan(["src/admin/pages/LoginPage.tsx"]).areas).toContain("auth");
  });

  it("checks D1 and Worker changes without a mandatory React frontend build", () => {
    const plan = createImpactPlan(["cloudflare/public-api/migrations/0031_update.sql"]);
    expect(plan.requiredLanes).toContain("worker");
    expect(plan.requiredLanes).toContain("integration");
    expect(plan.requiredLanes).not.toContain("build");
  });

  it("selects only relevant test lanes when only test files changed", () => {
    const plan = createImpactPlan(["src/test/integration/content.test.ts"]);
    expect(plan.requiredLanes).toEqual(["static-quality", "integration"]);
  });

  it("preserves integration, build, governance and browser coverage for the reviewed calendar utility", () => {
    const plan = createImpactPlan(["src/utils/calendar.ts"]);
    expect(plan.mode).toBe("affected");
    expect(plan.areas).toEqual(["admin"]);
    expect(plan.requiredLanes).toEqual(["static-quality", "unit", "integration", "build", "governance", "functional"]);
    expect(plan.requiredLanes).not.toContain("worker");
  });

  it("classifies both old and new paths for renames", () => {
    const plan = createImpactPlan([{ status: "renamed", path: "src/theme.ts", previousPath: "docs/old-theme.md" }]);
    expect(plan.changedPaths).toEqual(["docs/old-theme.md", "src/theme.ts"]);
    expect(plan.areas).toContain("design");
  });

  it("fails closed if rename metadata is absent", () => {
    const plan = createImpactPlan([{ status: "renamed", path: "docs/new.md" }]);
    expect(plan.mode).toBe("full");
    expect(plan.requiredLanes).toEqual(defaultImpactMap.lanes);
  });

  it.each([
    [],
    ["unknown/path.bin"],
    ["../outside-project"],
    ["src/shared/components/Button.tsx"],
    ["src/types.ts"],
    ["src/test/setup.ts"],
    ["cloudflare/public-api/src/contracts/publicRead.ts"],
    ["package.json"],
    [".github/workflows/ci.yml"],
    ["config/ci-impact-map.json"]
  ])("fails closed for ambiguous or globally impacting changes: %j", (paths) => {
    const plan = createImpactPlan(paths);
    expect(plan.mode).toBe("full");
    expect(plan.requiredLanes).toEqual(defaultImpactMap.lanes);
    expect(plan.skippedLanes).toEqual([]);
  });

  it("deduplicates paths and reports an auditable reason per unique file", () => {
    const plan = createImpactPlan(["README.md", "README.md", "./docs/guide.md"]);
    expect(plan.changedPaths).toEqual(["README.md", "docs/guide.md"]);
    expect(plan.reasons).toHaveLength(2);
  });
});
