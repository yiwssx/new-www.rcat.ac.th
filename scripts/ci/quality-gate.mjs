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
