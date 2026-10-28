import { defaultImpactMap } from "./impact-plan.mjs";

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

  if (plan.mode === "affected" && (!plan.gateReady || !plan.verifiedIntegration)) {
    errors.push("Selective plan is not backed by a verified integrated PR tree");
  }

  if (eventName !== "pull_request" && plan.mode !== "full") {
    errors.push("Push and manual runs must perform full source validation");
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
