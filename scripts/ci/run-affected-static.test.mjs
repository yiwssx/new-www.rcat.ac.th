// @vitest-environment node

import { describe, expect, it } from "vitest";
import { selectStaticQualityCommands } from "./run-affected-static.mjs";

const docsPlan = {
  version: 1,
  mode: "affected",
  gateReady: true,
  verifiedIntegration: true,
  areas: ["documentation"],
  requiredLanes: ["static-quality"],
  changedPaths: ["docs/architecture/ci-impact-aware-optimization-plan.md"],
  reasons: ["docs/architecture/ci-impact-aware-optimization-plan.md:docs"]
};

const exists = () => true;

describe("P3 selective Static Quality", () => {
  it("checks only a verified changed Markdown document in a docs-only PR", () => {
    const result = selectStaticQualityCommands(docsPlan, "pull_request", exists);
    expect(result.mode).toBe("docs-only");
    expect(result.commands).toEqual([
      ["exec", "prettier", "--check", "docs/architecture/ci-impact-aware-optimization-plan.md"]
    ]);
  });

  it("checks multiple docs and root README with deterministic ordering", () => {
    const plan = {
      ...docsPlan,
      changedPaths: ["README.md", "docs/guide.md", "docs/policy.json"]
    };
    const result = selectStaticQualityCommands(plan, "pull_request", exists);
    expect(result.commands).toEqual([
      ["exec", "prettier", "--check", "README.md", "docs/guide.md", "docs/policy.json"]
    ]);
  });

  it.each(["push", "workflow_dispatch", "merge_group"])("keeps full checks for %s", (eventName) => {
    expect(selectStaticQualityCommands(docsPlan, eventName, exists).mode).toBe("full");
  });

  it.each([
    { ...docsPlan, mode: "full" },
    { ...docsPlan, gateReady: false },
    { ...docsPlan, verifiedIntegration: false },
    { ...docsPlan, version: 2 },
    { ...docsPlan, areas: ["documentation", "public"] },
    { ...docsPlan, requiredLanes: ["static-quality", "unit"] },
    { ...docsPlan, reasons: [] },
    { ...docsPlan, changedPaths: [] },
    { ...docsPlan, changedPaths: ["docs/image.png"] },
    { ...docsPlan, changedPaths: ["docs/../src/auth.ts"] },
    { ...docsPlan, changedPaths: ["src/theme.ts"] },
    { ...docsPlan, changedPaths: ["docs/one.md", "docs/one.md"] }
  ])("keeps full formatting and lint for unsafe or broader changes: %j", (plan) => {
    const result = selectStaticQualityCommands(plan, "pull_request", exists);
    expect(result.mode).toBe("full");
    expect(result.commands).toEqual([["format:check"], ["lint:strict"]]);
  });

  it("does not narrow checks for deleted documents or symlinks", () => {
    const result = selectStaticQualityCommands(docsPlan, "pull_request", () => false);
    expect(result.mode).toBe("full");
  });

  it("defaults to full checks if the impact plan is missing or corrupted", () => {
    expect(selectStaticQualityCommands(null, "pull_request", exists).mode).toBe("full");
  });
});
