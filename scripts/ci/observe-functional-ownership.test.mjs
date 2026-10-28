// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  FUNCTIONAL_OWNER_CANDIDATES,
  formatFunctionalOwnershipReport,
  observeFunctionalOwnership
} from "./observe-functional-ownership.mjs";
import { selectFunctionalTestCommand } from "./run-affected-functional.mjs";

const base = {
  mode: "affected",
  gateReady: true,
  verifiedIntegration: true,
  changedPaths: ["src/public/components/PublicHomeCarousel.tsx"],
  areas: ["public"],
  requiredLanes: ["static-quality", "unit", "build", "governance", "functional"]
};
const exists = () => true;

describe("source-to-E2E shadow-mode ownership canary", () => {
  it("records reviewable candidate specs but retains the full browser suite", () => {
    const observed = observeFunctionalOwnership(base, "pull_request", exists);
    expect(observed.mode).toBe("candidate-only");
    expect(observed.candidateSpecs).toEqual(["tests/functional/carousel.spec.ts", "tests/functional/smoke.spec.ts"]);
    expect(selectFunctionalTestCommand(base, "pull_request", exists).mode).toBe("full");
    expect(formatFunctionalOwnershipReport(observed)).toContain("full Functional E2E is unchanged");
  });

  it("deduplicates multiple related source owners and tolerates docs-only companions", () => {
    const plan = {
      ...base,
      changedPaths: [
        "docs/architecture/ci-guide.md",
        "src/public/components/PublicCookieConsent.tsx",
        "src/public/cookies/usePublicCookieConsent.ts"
      ]
    };
    const observed = observeFunctionalOwnership(plan, "pull_request", exists);
    expect(observed.sourceFiles).toBe(2);
    expect(observed.candidateSpecs).toEqual([
      "tests/functional/publicCookieConsent.spec.ts",
      "tests/functional/publicTelemetry.spec.ts"
    ]);
  });

  it("anchors every declared candidate in the trusted functional suite", () => {
    for (const [source, specs] of Object.entries(FUNCTIONAL_OWNER_CANDIDATES)) {
      expect(source).toMatch(/^src\//);
      expect(specs.length).toBeGreaterThan(0);
      for (const spec of specs) expect(spec).toMatch(/^tests\/functional\/[\w.-]+\.spec\.ts$/);
    }
  });

  it.each([
    { ...base, changedPaths: ["src/public/components/PublicHomeCarousel.tsx", "src/types.ts"] },
    { ...base, changedPaths: ["src/public/components/PublicHomeCarousel.tsx", "server/cmsAuth/handlers.mjs"] },
    { ...base, changedPaths: ["src/shared/telemetry/publicTelemetryRoutes.ts"] },
    { ...base, changedPaths: ["src/public/components/PublicHomeCarousel.tsx", "tests/functional/smoke.spec.ts"] },
    { ...base, changedPaths: ["src/public/components/../components/PublicHomeCarousel.tsx"] },
    { ...base, changedPaths: ["src/public/components/PublicHomeCarousel.tsx", ".github/workflows/ci.yml"] },
    { ...base, changedPaths: ["docs/guide.md"] },
    { ...base, changedPaths: [] },
    { ...base, verifiedIntegration: false },
    { ...base, gateReady: false },
    { ...base, mode: "full" },
    { ...base, requiredLanes: ["unit"] }
  ])("emits no candidate when owner coverage or integration identity is uncertain: %j", (plan) => {
    expect(observeFunctionalOwnership(plan, "pull_request", exists).mode).toBe("full-e2e-only");
    expect(selectFunctionalTestCommand(plan, "pull_request", exists).mode).toBe("full");
  });

  it.each(["push", "workflow_dispatch", "merge_group"])(
    "does not claim selective source ownership on %s",
    (eventName) => {
      expect(observeFunctionalOwnership(base, eventName, exists).candidateSpecs).toEqual([]);
    }
  );

  it("fails closed when source or candidate spec is absent or symlinked", () => {
    expect(observeFunctionalOwnership(base, "pull_request", () => false).mode).toBe("full-e2e-only");
    expect(
      observeFunctionalOwnership(base, "pull_request", (path) => path !== "tests/functional/carousel.spec.ts").mode
    ).toBe("full-e2e-only");
  });

  it("rejects untrusted paths and malformed plans", () => {
    for (const path of ["/src/public/components/PublicHomeCarousel.tsx", "src/public/../../evil", "src/\0bad"]) {
      expect(
        observeFunctionalOwnership({ ...base, changedPaths: [path] }, "pull_request", exists).candidateSpecs
      ).toEqual([]);
    }
    expect(observeFunctionalOwnership(null, "pull_request", exists).mode).toBe("full-e2e-only");
  });
});
