import { describe, expect, it } from "vitest";
import { runPublicLayoutStabilityGovernance, scanPublicLayoutSource } from "./public-layout-stability-governance.mjs";

describe("Public layout stability governance", () => {
  it("accepts the committed Public shell stability architecture", () => {
    expect(runPublicLayoutStabilityGovernance(process.cwd())).toEqual([]);
  });

  it("detects a progress-only Public loading regression", () => {
    const violations = scanPublicLayoutSource(
      "src/public/components/PublicLoadingState.tsx",
      `export default function PublicLoadingState() { return <LinearProgress />; }`
    );

    expect(violations.map((violation) => violation.rule)).toContain("structured-public-loading");
  });

  it("detects Footer Directory state and Auth/Admin boundary regressions", () => {
    const violations = scanPublicLayoutSource(
      "src/public/components/PublicFooterDirectory.tsx",
      `
        import { useAuth } from "../../features/cms-auth";
        export function FooterDirectory() { return null; }
      `
    );
    const rules = violations.map((violation) => violation.rule);

    expect(rules).toContain("footer-directory-state");
    expect(rules).toContain("footer-directory-placeholder");
    expect(rules).toContain("public-shell-import-boundary");
  });
});
