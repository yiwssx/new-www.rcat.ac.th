import { createImpactPlan, defaultImpactMap } from "./impact-plan.mjs";
import { isAllowlistedMainSource, isSafeMainDocument } from "./detect-impact.mjs";
import { makeReader, trustedPrE2E } from "./reuse-functional-e2e.mjs";

export function validateQualityGate(plan, results, impactStatus, preflightStatus, eventName) {
  const errors = [];
  const lanes = defaultImpactMap.lanes;

  if (impactStatus !== "success") errors.push("Impact detector did not succeed");
  if (preflightStatus !== "success") errors.push("Dependency preflight did not succeed");
  if (!plan || !["affected", "full"].includes(plan.mode) || plan.version !== defaultImpactMap.version) {
    errors.push("Missing or invalid impact plan");
    return errors;
  }

  if (!Array.isArray(plan.requiredLanes) || !Array.isArray(plan.skippedLanes) || !Array.isArray(plan.reasons)) {
    errors.push("Invalid impact plan structure");
    return errors;
  }

  const required = new Set(plan.requiredLanes);
  const skipped = new Set(plan.skippedLanes);
  const sourceEntries = plan.changedEntries;
  const sourceSafe =
    eventName === "push" &&
    plan.mode === "affected" &&
    plan.gateReady === true &&
    plan.verifiedPush === true &&
    plan.verifiedIntegration === false &&
    /^[0-9a-f]{40}$/i.test(plan.beforeSha ?? "") &&
    /^[0-9a-f]{40}$/i.test(plan.checkoutSha ?? "") &&
    plan.beforeSha !== plan.checkoutSha &&
    Array.isArray(sourceEntries) &&
    sourceEntries.length > 0 &&
    sourceEntries.length <= 60 &&
    sourceEntries.every(
      (entry) =>
        (entry.status === "added" || entry.status === "modified") &&
        typeof entry.path === "string" &&
        (isAllowlistedMainSource(entry.path) || isSafeMainDocument(entry.path))
    );

  let verifiedScopedPush = false;
  if (sourceSafe) {
    const expected = createImpactPlan(sourceEntries);
    const proof = plan.reuseFunctional;
    const proofShape =
      proof &&
      /^[0-9a-f]{40}$/i.test(proof.treeSha ?? "") &&
      proof.mainSha === plan.checkoutSha &&
      proof.beforeSha === plan.beforeSha &&
      /^[0-9a-f]{40}$/i.test(proof.prHeadSha ?? "") &&
      [proof.prNumber, proof.prRunId, proof.runAttempt, proof.e2eJobId, proof.qualityJobId].every(
        (value) => Number.isInteger(value) && value > 0
      );
    const reusable = Boolean(
      proofShape &&
      expected.requiredLanes.includes("functional") &&
      sourceEntries.some((entry) => isAllowlistedMainSource(entry.path))
    );
    const expectedRequired = reusable
      ? expected.requiredLanes.filter((lane) => lane !== "functional")
      : expected.requiredLanes;
    const expectedSkipped = reusable
      ? [...expected.skippedLanes, "functional"]
      : expected.skippedLanes;
    const expectedReasons = [
      ...expected.reasons,
      "verified-main-scoped-impact-range",
      ...(reusable ? ["reused-pr-full-e2e-identical-tree"] : [])
    ];
    verifiedScopedPush =
      expected.mode === "affected" &&
      (!proof || reusable) &&
      sourceEntries.some((entry) => isAllowlistedMainSource(entry.path)) &&
      JSON.stringify(plan.changedPaths) === JSON.stringify(expected.changedPaths) &&
      JSON.stringify(plan.areas) === JSON.stringify(expected.areas) &&
      JSON.stringify(plan.requiredLanes) === JSON.stringify(expectedRequired) &&
      JSON.stringify(plan.skippedLanes) === JSON.stringify(expectedSkipped) &&
      JSON.stringify(plan.reasons) === JSON.stringify(expectedReasons);
  }

  const verifiedDocsPush =
    eventName === "push" &&
    plan.mode === "affected" &&
    plan.gateReady === true &&
    plan.verifiedPush === true &&
    plan.verifiedIntegration === false &&
    /^[0-9a-f]{40}$/i.test(plan.beforeSha ?? "") &&
    /^[0-9a-f]{40}$/i.test(plan.checkoutSha ?? "") &&
    plan.beforeSha !== plan.checkoutSha &&
    Array.isArray(plan.changedPaths) &&
    plan.changedPaths.length > 0 &&
    plan.changedPaths.length <= 60 &&
    plan.changedPaths.every(isSafeMainDocument) &&
    new Set(plan.changedPaths).size === plan.changedPaths.length &&
    Array.isArray(plan.areas) &&
    plan.areas.length === 1 &&
    plan.areas[0] === "documentation" &&
    Array.isArray(plan.reasons) &&
    plan.reasons.includes("verified-main-docs-only-range") &&
    required.size === 1 &&
    required.has("static-quality") &&
    skipped.size === defaultImpactMap.lanes.length - 1;

  if (
    required.size !== plan.requiredLanes.length ||
    skipped.size !== plan.skippedLanes.length ||
    !lanes.every((lane) => required.has(lane) !== skipped.has(lane)) ||
    [...required, ...skipped].some((lane) => !lanes.includes(lane))
  ) {
    errors.push("Impact plan has missing, duplicate, or unknown lanes");
  }

  if (plan.mode === "full" && (skipped.size > 0 || required.size !== lanes.length)) {
    errors.push("Full-impact plan must require every CI lane");
  }

  if (plan.mode === "affected" && (!plan.gateReady || (eventName === "pull_request" && !plan.verifiedIntegration))) {
    errors.push("Selective plan is not backed by a verified integrated PR tree");
  }

  if (eventName === "push" && plan.mode !== "full" && !verifiedDocsPush && !verifiedScopedPush) {
    errors.push("Only verified documentation or allowlisted source main pushes may use selective validation");
  }

  if (eventName !== "pull_request" && eventName !== "push" && plan.mode !== "full") {
    errors.push("Manual and unknown events must perform full validation");
  }

  if (plan.reasons.length === 0 || !plan.reasons.every((reason) => typeof reason === "string" && reason)) {
    errors.push("Impact plan must explain every decision");
  }

  for (const lane of lanes) {
    const actual = results?.[lane];
    const expected = required.has(lane) ? "success" : "skipped";
    if (actual !== expected) {
      errors.push(lane + ": expected " + expected + ", got " + String(actual));
    }
  }

  return errors;
}

/**
 * Auditable, read-only report for the final required quality check.
 * Reporting never changes the fail-closed verdict from validateQualityGate.
 */
export function formatQualityGateSummary({ plan, results, impactStatus, preflightStatus, eventName, errors }) {
  const safeText = (value) =>
    String(value ?? "missing")
      .replace(/[\r\n|<>`]/g, " ")
      .slice(0, 240);
  const required = new Set(Array.isArray(plan?.requiredLanes) ? plan.requiredLanes : []);
  let reasons = "missing";
  if (Array.isArray(plan?.reasons) && plan.reasons.length > 0) {
    reasons = plan.reasons.map(safeText).join("; ");
  }

  const lines = [
    "### RCAT CI quality gate",
    "",
    `- Verdict: **${errors.length === 0 ? "PASS" : "FAIL"}**`,
    `- Event: ${safeText(eventName)}`,
    `- Impact mode: ${safeText(plan?.mode)}`,
    `- Verified integration: ${plan?.verifiedIntegration === true}`,
    `- Change-impact job: ${safeText(impactStatus)}`,
    `- Dependency preflight: ${safeText(preflightStatus)}`,
    `- Reasons: ${reasons}`,
    ...(plan?.reuseFunctional
      ? [`- Full Functional E2E: **REUSED** successful PR #${safeText(plan.reuseFunctional.prNumber)} / CI run ${safeText(plan.reuseFunctional.prRunId)} on identical Git tree ${safeText(plan.reuseFunctional.treeSha)}`]
      : []),
    "",
    "| Lane | Planned | Observed | Match |",
    "| --- | --- | --- | --- |"
  ];

  for (const lane of defaultImpactMap.lanes) {
    const planned = required.has(lane) ? "success" : "skipped";
    const actual = results?.[lane] ?? "missing";
    const match = actual === planned ? "yes" : "NO";
    lines.push(`| ${lane} | ${planned} | ${safeText(actual)} | ${match} |`);
  }

  if (errors.length > 0) {
    lines.push("", "#### Gate failures", ...errors.map((error) => `- ${safeText(error)}`));
  }

  lines.push(
    "",
    "Skipped lanes are accepted only when backed by a validated change-impact plan. " +
      "The final gate always rejects unexpected results, detector failures, and missing preflight."
  );
  return lines.join("\n") + "\n";
}

if (process.argv[1] && process.argv[1].endsWith("/quality-gate.mjs")) {
  const requiredEnv = ["CI_PLAN", "CI_RESULTS", "CI_IMPACT_STATUS", "CI_PREFLIGHT_STATUS", "GITHUB_EVENT_NAME"];
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error("Missing CI gate inputs: " + missing.join(", "));
    process.exitCode = 1;
  } else {
    try {
      const plan = JSON.parse(process.env.CI_PLAN);
      const results = JSON.parse(process.env.CI_RESULTS);
      const errors = validateQualityGate(
        plan,
        results,
        process.env.CI_IMPACT_STATUS,
        process.env.CI_PREFLIGHT_STATUS,
        process.env.GITHUB_EVENT_NAME
      );
      if (plan.reuseFunctional) {
        const get = makeReader(process.env.GITHUB_REPOSITORY, process.env.GITHUB_TOKEN);
        const verified = await trustedPrE2E({
          repo: process.env.GITHUB_REPOSITORY,
          mainSha: plan.checkoutSha,
          beforeSha: plan.beforeSha,
          get
        });
        if (!verified || JSON.stringify(verified) !== JSON.stringify(plan.reuseFunctional)) {
          errors.push("Prior Full E2E evidence could not be independently verified");
        }
      }
      console.log("RCAT CI lanes:", JSON.stringify({ mode: plan.mode, required: plan.requiredLanes, results }));
      if (process.env.GITHUB_STEP_SUMMARY) {
        try {
          const { appendFileSync } = await import("node:fs");
          appendFileSync(
            process.env.GITHUB_STEP_SUMMARY,
            formatQualityGateSummary({
              plan,
              results,
              impactStatus: process.env.CI_IMPACT_STATUS,
              preflightStatus: process.env.CI_PREFLIGHT_STATUS,
              eventName: process.env.GITHUB_EVENT_NAME,
              errors
            })
          );
        } catch (error) {
          console.warn("Unable to write CI quality summary:", error instanceof Error ? error.message : String(error));
        }
      }
      if (errors.length > 0) {
        for (const error of errors) console.error("CI quality gate: " + error);
        process.exitCode = 1;
      } else {
        console.log("CI quality gate passed with verified skip reasons");
      }
    } catch (error) {
      console.error("Invalid CI gate payload:", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
