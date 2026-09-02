import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  throw new Error(`P6C recovery/reliability governance failed: ${message}`);
};

const readiness = JSON.parse(read("config/p6c-recovery-readiness.json"));
const expectedGates = [
  "repositoryCi",
  "unattendedReliabilitySmoke",
  "d1TimeTravelReadiness",
  "workerRollbackReadiness",
  "vercelRollbackReadiness",
  "appsScriptRollbackReadiness",
  "closureEvidence"
];
const allowedStates = new Set(["pending", "ready", "passed", "blocked"]);

if (readiness.phase !== "P6C" || !["active", "closed"].includes(readiness.status)) {
  fail("readiness model must identify P6C with active/closed status");
}
if (!readiness.rollbackOwner) {
  fail("rollback ownership must be explicit");
}
if (readiness.objectives?.runtimeRtoMinutes !== 30) {
  fail("runtime RTO target must remain 30 minutes unless explicitly re-reviewed");
}
if (readiness.objectives?.d1RestoreDecisionRtoMinutes !== 30) {
  fail("D1 restore-decision RTO target must remain 30 minutes unless explicitly re-reviewed");
}
if (readiness.objectives?.d1TargetRpoMinutes !== 5) {
  fail("D1 target RPO must remain 5 minutes unless explicitly re-reviewed");
}

const actualGates = Object.keys(readiness.gates || {}).sort();
if (actualGates.join("\n") !== [...expectedGates].sort().join("\n")) {
  fail(`readiness gates must be exactly: ${expectedGates.join(", ")}`);
}
for (const gate of expectedGates) {
  if (!allowedStates.has(readiness.gates[gate])) {
    fail(`${gate} has an invalid readiness state`);
  }
  if (!Array.isArray(readiness.evidence?.[gate])) {
    fail(`${gate} must retain an evidence array`);
  }
}

const reliabilityWorkflow = read(".github/workflows/p6c-production-reliability.yml");
if (!reliabilityWorkflow.includes('cron: "7 */6 * * *"')) {
  fail("unattended reliability smoke must retain the six-hour bounded schedule");
}
if (reliabilityWorkflow.includes('cron: "7,37 * * * *"')) {
  fail("the retired twice-hourly reliability schedule must not return");
}
if (reliabilityWorkflow.includes("environment: production") || reliabilityWorkflow.includes("secrets.")) {
  fail("unattended public reliability smoke must not consume protected production secrets");
}
if (!reliabilityWorkflow.includes("scripts/p6c-production-reliability-smoke.mjs")) {
  fail("reliability workflow must execute the P6C production smoke");
}
if (!reliabilityWorkflow.includes("intentionally owned by P6B Production Security")) {
  fail("P6C workflow must document that scheduled WAF ownership belongs to P6B");
}

const reliabilitySmoke = read("scripts/p6c-production-reliability-smoke.mjs");
for (const contract of ['"/"', '"/login"', "/search?q=", "p6b-enforced-v1", "no-store"]) {
  if (!reliabilitySmoke.includes(contract)) {
    fail(`production reliability smoke is missing contract ${contract}`);
  }
}
if (reliabilitySmoke.includes("/api/internal/") || reliabilitySmoke.includes("p6b-vercel-v1")) {
  fail("P6C reliability smoke must not duplicate the P6B Vercel edge WAF probe");
}

const d1Drill = read(".github/workflows/d1-recovery-drill.yml");
if (!d1Drill.includes("secrets.CLOUDFLARE_D1_READ_TOKEN")) {
  fail("D1 readiness drill must use the dedicated read-only token");
}
if (/d1\s+time-travel\s+restore/.test(d1Drill.replace(/grep[^\n]+restore[^\n]*/g, ""))) {
  fail("D1 readiness drill must not execute a Time Travel restore");
}
if (!d1Drill.includes("environment: production")) {
  fail("D1 readiness drill must remain behind the protected production Environment");
}

const workerRollback = read(".github/workflows/worker-production-rollback.yml");
for (const contract of [
  "ROLLBACK_WORKER_RUNTIME_ONLY",
  "git merge-base --is-ancestor",
  "CMS_AUTH_RATE_LIMITER",
  "ADMIN_API_RATE_LIMITER",
  "secrets.CLOUDFLARE_API_TOKEN",
  "environment: production",
  "scripts/deploy-worker-runtime-rollback.mjs",
  "scripts/p6c-production-reliability-smoke.mjs"
]) {
  if (!workerRollback.includes(contract)) {
    fail(`Worker rollback workflow is missing contract ${contract}`);
  }
}
if (workerRollback.includes("d1 migrations apply") || workerRollback.includes("d1 time-travel restore")) {
  fail("Worker runtime rollback must not migrate or restore D1");
}

const workerRollbackHelper = read("scripts/deploy-worker-runtime-rollback.mjs");
if (!workerRollbackHelper.includes('["exec", "wrangler", "deploy"')) {
  fail("Worker rollback helper must deploy the extracted Worker runtime");
}
if (/d1\s|migrations|time-travel\s+restore/.test(workerRollbackHelper)) {
  fail("Worker rollback helper must remain runtime-only and contain no D1 operation");
}
if (!workerRollbackHelper.includes("createProductionWranglerConfig")) {
  fail("Worker rollback helper must inject the protected production D1 identity through the existing guard");
}

const appsScriptRollback = read(".github/workflows/apps-script-production-rollback.yml");
for (const contract of [
  "ROLLBACK_EXISTING_APPS_SCRIPT_WEB_APP",
  "environment: production",
  "secrets.CLASPRC_JSON",
  "secrets.CLASP_JSON",
  "secrets.APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID",
  "verify-health"
]) {
  if (!appsScriptRollback.includes(contract)) {
    fail(`Apps Script rollback path is missing contract ${contract}`);
  }
}

const runbook = read("docs/operations/p6c-recovery-reliability.md");
const expectedRunbookStatus = readiness.status === "closed" ? "Status: closed." : "Status: active.";
for (const contract of [
  expectedRunbookStatus,
  "Do not combine runtime rollback and data restore by default.",
  "does **not** run `wrangler d1 migrations apply`",
  "does **not** run D1 Time Travel restore",
  "does not add a Vercel token",
  "every six hours",
  "P6B Production Security owns the scheduled WAF smoke"
]) {
  if (!runbook.includes(contract)) {
    fail(`P6C runbook is missing contract: ${contract}`);
  }
}

if (readiness.status === "closed") {
  if (!readiness.closedAt) {
    fail("closed P6C requires closedAt evidence");
  }
  if (!runbook.includes("## Closure evidence")) {
    fail("closed P6C runbook must retain a closure evidence section");
  }
  for (const gate of expectedGates) {
    if (readiness.gates[gate] !== "passed") {
      fail(`closed P6C requires ${gate}=passed`);
    }
    if (readiness.evidence[gate].length === 0) {
      fail(`closed P6C requires retained evidence for ${gate}`);
    }
  }
}

console.log(
  `P6C recovery/reliability governance: ${readiness.status}; ${expectedGates
    .map((gate) => `${gate}=${readiness.gates[gate]}`)
    .join(", ")}.`
);
