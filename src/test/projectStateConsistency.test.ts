// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const currentFacingPaths = [
  "README.md",
  ".github/copilot-instructions.md",
  "AGENTS.md",
  "docs/architecture/post-p5h-current-project-state.md",
  "docs/architecture/reliability-roadmap-v2.md",
  "docs/architecture/current-runtime-ownership.md",
  "docs/deployment/runtime-deployment-guide.md",
  "docs/operations/phase-a-field-qa-foundation.md",
  "docs/operations/phase-b-operational-visibility.md",
  "docs/production-readiness-checklist.md",
  "docs/production-smoke-checklist.md",
  "docs/launch-data-runbook.md",
  "docs/features/site-view-tracking.md",
  "docs/features/public-documents.md",
  "docs/production-smoke-test-report-template.md",
  "cloudflare/public-api/seed/README.md"
] as const;

const currentFacingSources = Object.fromEntries(
  currentFacingPaths.map((relativePath) => [relativePath, readFileSync(join(repositoryRoot, relativePath), "utf8")])
) as Record<(typeof currentFacingPaths)[number], string>;

const canonicalState = currentFacingSources["docs/architecture/post-p5h-current-project-state.md"];
const reliabilityRoadmap = currentFacingSources["docs/architecture/reliability-roadmap-v2.md"];
const currentRuntime = currentFacingSources["docs/architecture/current-runtime-ownership.md"];
const deploymentGuide = currentFacingSources["docs/deployment/runtime-deployment-guide.md"];
const phaseARunbook = currentFacingSources["docs/operations/phase-a-field-qa-foundation.md"];
const phaseBRunbook = currentFacingSources["docs/operations/phase-b-operational-visibility.md"];
const copilotInstructions = currentFacingSources[".github/copilot-instructions.md"];
const agents = currentFacingSources["AGENTS.md"];

const staleActiveStatusPatterns = [
  /M21 owns remaining/i,
  /M21 stabilization is open/i,
  /M21\s+รับผิดชอบงาน\s+stabilization/i,
  /preview field verification in progress\.\s*M20 production cutover remains gated/i,
  /B3 Health Aggregation remains planned/i,
  /B3 is the only planned Phase B roadmap item/i,
  /Phase B(?: Operational Visibility)? (?:is|remains) (?:the )?active/i,
  /VITE_PUBLIC_API_PROVIDER\s*=\s*cloudflare/i,
  /A full public `\/documents` archive route is not included yet/i,
  /Search is client-side\/public snapshot search/i,
  /The server renderer is non-streaming/i
];

describe("current project-state consistency", () => {
  it("keeps stale current-state/runtime language out of current-facing guidance", () => {
    for (const [relativePath, source] of Object.entries(currentFacingSources)) {
      for (const pattern of staleActiveStatusPatterns) {
        expect(source, `${relativePath} contains stale current-facing wording: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("keeps the canonical reliability state unambiguous", () => {
    expect(canonicalState).toContain("Phase B Operational Visibility is complete and production-verified");
    expect(canonicalState).toContain(
      "B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete"
    );
    expect(canonicalState).toContain("There is no active Reliability Roadmap v2 phase");
    expect(canonicalState).toContain("Phase C Deep Field Verification is complete");

    expect(reliabilityRoadmap).toContain("| Phase B | Operational Visibility   | Complete");
    expect(reliabilityRoadmap).toContain(
      "B1 protected live health checks, B2 privacy-safe Runtime Incident Feed, and B3 server-owned Health Aggregation are complete and production-verified"
    );
    expect(reliabilityRoadmap).toContain("### B3 — Health Aggregation");
    expect(reliabilityRoadmap).toContain("Status: complete and production-verified.");
    expect(reliabilityRoadmap).toContain("| Phase C | Deep Field Verification  | Complete");
  });

  it("keeps current runtime/deployment guidance aligned with implemented SSR, Search, B2, and B3", () => {
    for (const source of [currentRuntime, deploymentGuide]) {
      expect(source).toContain("renderRouterToStream");
      expect(source).toContain("/api/health-aggregation");
      expect(source).toContain("runtime-incidents");
      expect(source).toContain("/content/:slug");
      expect(source).toContain("no-store");
    }

    expect(currentRuntime).toContain("Public Search is Worker/D1-owned");
    expect(currentRuntime).toContain("There is no `PUBLIC_API_PROVIDER` or `VITE_PUBLIC_API_PROVIDER` runtime selector");
  });

  it("keeps Phase A wording aligned with the real commit-status gate and completed later phases", () => {
    expect(phaseARunbook).toContain("This is a commit-status gate, not a direct Vercel deployment-record lookup");
    expect(phaseARunbook).toContain("Canceled by Ignored Build Step");
    expect(phaseARunbook).toContain("Reliability Roadmap v2 is complete");
    expect(phaseARunbook).toContain("Phase C3 is a manual/protected authenticated disposable CMS regression tool");
  });

  it("records B1, B2, and B3 as completed Phase B work", () => {
    expect(phaseBRunbook).toContain(
      "B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete and production-verified"
    );
    expect(phaseBRunbook).toContain("## B3 — Health Aggregation");
    expect(phaseBRunbook).toContain("PR #270 merged to `master` as `cda947149fee0e79791bfc401efbc5c33f3adbb9`");
    expect(phaseBRunbook).toContain("CI #2007, run `34547284821`");
    expect(phaseBRunbook).toContain("Vercel production deployment `dpl_94AZDYbaLc61t2XbmxMFCw1GQZyP`");
    expect(phaseBRunbook).toContain("Phase B Operational Visibility is complete and production-verified");
  });

  it("keeps repository AI guidance on the completed post-P5H reliability baseline", () => {
    for (const source of [copilotInstructions, agents]) {
      expect(source).toContain("post-P5H production governance baseline");
      expect(source).toContain(
        "B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete and production-verified"
      );
      expect(source).toContain("C3");
      expect(source).toMatch(/manual(?:\/protected|-only)/i);
    }
  });
});
