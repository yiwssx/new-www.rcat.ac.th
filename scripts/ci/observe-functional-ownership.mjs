import { appendFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Explicit, reviewable *candidate* owners; this is not a transitive dependency graph.
// A hit is useful for comparing outcomes against full E2E, never for skipping tests.
export const FUNCTIONAL_OWNER_CANDIDATES = Object.freeze({
  "src/public/components/PublicHomeCarousel.tsx": [
    "tests/functional/carousel.spec.ts",
    "tests/functional/smoke.spec.ts"
  ],
  "src/public/utils/homeCarouselInteraction.ts": ["tests/functional/carousel.spec.ts"],
  "src/public/components/PublicCookieConsent.tsx": [
    "tests/functional/publicCookieConsent.spec.ts",
    "tests/functional/publicTelemetry.spec.ts"
  ],
  "src/public/cookies/usePublicCookieConsent.ts": [
    "tests/functional/publicCookieConsent.spec.ts",
    "tests/functional/publicTelemetry.spec.ts"
  ],
  "src/shared/telemetry/PublicTelemetry.tsx": [
    "tests/functional/publicTelemetry.spec.ts",
    "tests/functional/publicCookieConsent.spec.ts"
  ],
  "src/public/components/OrganizationChartView.tsx": [
    "tests/functional/organizationAccessibility.spec.ts"
  ],
  "src/admin/components/OrganizationAssignmentTransferDialog.tsx": [
    "tests/functional/organizationAssignmentTransfer.spec.ts"
  ]
});

const DOC_PATH = /^(?:docs\/[A-Za-z0-9_./-]+|README\.md|CHANGELOG\.md|CONTRIBUTING\.md)$/;
const SOURCE_PATH = /^(?:src\/|server\/|cloudflare\/public-api\/)/;

function isSafePath(path) {
  return (
    typeof path === "string" &&
    /^[A-Za-z0-9_./-]+$/.test(path) &&
    !path.startsWith("/") &&
    !path.split("/").some((part) => part === "." || part === ".." || part === "")
  );
}

/**
 * Shadow-mode diagnostic only: always execute the existing full E2E command for
 * source changes, even when every changed source path has a candidate owner.
 * Unknown, unsafe, mixed-source, auth, config, renamed and deleted changes
 * yield no narrower candidate. No selection output is a release-gate input.
 */
export function observeFunctionalOwnership(plan, eventName, isRegularFile) {
  const unavailable = (reason) => ({ mode: "full-e2e-only", reason, candidateSpecs: [], sourceFiles: 0 });
  if (
    eventName !== "pull_request" ||
    plan?.mode !== "affected" ||
    plan.gateReady !== true ||
    plan.verifiedIntegration !== true ||
    !Array.isArray(plan.changedPaths) ||
    plan.changedPaths.length === 0 ||
    plan.changedPaths.length > 20 ||
    !Array.isArray(plan.requiredLanes) ||
    !plan.requiredLanes.includes("functional")
  ) {
    return unavailable("unverified-or-broad-impact");
  }

  const sources = [];
  for (const path of plan.changedPaths) {
    if (!isSafePath(path)) return unavailable("unsafe-or-invalid-path");
    if (DOC_PATH.test(path)) continue;
    if (!SOURCE_PATH.test(path) || !Object.hasOwn(FUNCTIONAL_OWNER_CANDIDATES, path)) {
      return unavailable("unmapped-source-or-mixed-change");
    }
    if (!isRegularFile(path)) return unavailable("missing-or-nonregular-source");
    sources.push(path);
  }
  if (!sources.length || new Set(sources).size !== sources.length) return unavailable("no-distinct-source-paths");

  const specs = [...new Set(sources.flatMap((path) => FUNCTIONAL_OWNER_CANDIDATES[path]))].sort();
  if (specs.some((path) => !isRegularFile(path))) return unavailable("missing-or-nonregular-owner-spec");

  return {
    mode: "candidate-only",
    reason: "explicit-static-owner-candidates-not-proven-complete",
    candidateSpecs: specs,
    sourceFiles: sources.length
  };
}

export function formatFunctionalOwnershipReport(result) {
  const lines = [
    "### Functional E2E source ownership — shadow-mode canary",
    "",
    "- Execution: **full Functional E2E is unchanged and remains required**.",
    "- Candidate mapping: manual, exact-path hints; no dynamic/import/transitive completeness proof.",
    `- Observation: ${result.mode} (${result.reason})`,
    `- Reviewed source files: ${result.sourceFiles}`,
    `- Candidate browser specs: ${result.candidateSpecs.length}`
  ];
  if (result.candidateSpecs.length) {
    lines.push("", "Candidate specs (diagnostic only):", ...result.candidateSpecs.map((path) => `- \`${path}\``));
  }
  lines.push(
    "",
    "Do not use this result to skip a spec or to satisfy the required quality gate. " +
      "Source-to-E2E coverage, dynamic imports, and cross-area dependencies must be canary-verified first."
  );
  return lines.join("\n") + "\n";
}

function regularFile(path) {
  try {
    const stat = lstatSync(resolve(path));
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let plan;
  try {
    plan = JSON.parse(process.env.CI_PLAN ?? "null");
  } catch {
    plan = null;
  }
  const observation = observeFunctionalOwnership(plan, process.env.GITHUB_EVENT_NAME, regularFile);
  const report = formatFunctionalOwnershipReport(observation);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
    } catch (error) {
      console.warn("Could not append optional E2E observation:", error instanceof Error ? error.message : String(error));
    }
  }
}
