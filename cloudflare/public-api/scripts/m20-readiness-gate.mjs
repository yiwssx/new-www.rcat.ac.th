/* global console, process */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const externalOperatorBlockers = [
  "post-M19 public-read preview smoke evidence",
  "production identity and RBAC approval",
  "sanitized full structured data inventory and reconciliation",
  "Google Drive media bridge ownership, recovery, and reconciliation approval",
  "preview-only migration verification evidence",
  "backup, restore, rollback, monitoring, and final cutover authority"
];

const requiredFiles = {
  currentStatus: "docs/architecture/current-migration-status.md",
  m19Doc: "docs/architecture/m19-parity-gap-assessment-2026-06-19.md",
  m20Doc: "docs/architecture/m20-production-readiness-gate.md",
  m20Runbook: "docs/operations/m20-readiness-runbook.md",
  wrangler: "cloudflare/public-api/wrangler.toml",
  publicProvider: "src/config/publicApiProvider.ts",
  mediaApi: "src/features/cms-media/api.ts",
  rootPackage: "package.json",
  workerPackage: "cloudflare/public-api/package.json"
};

const requiredM20DocSections = [
  /Current state after M19/i,
  /Scope of M20-P0/i,
  /Non-goals/i,
  /Production safety boundaries/i,
  /External operator blockers/i,
  /Required evidence format/i,
  /Required rehearsal flow/i,
  /Backup \/ restore \/ rollback expectations/i,
  /Cutover authority requirements/i,
  /Go \/ No-Go checklist/i,
  /Rollback checklist/i,
  /Redacted evidence policy/i
];

const requiredRunbookSections = [
  /Post-M19 public-read preview smoke/i,
  /Preview-only migration verification/i,
  /Admin write preview smoke/i,
  /Full structured data inventory/i,
  /Cross-provider reconciliation/i,
  /Media bridge verification/i,
  /Identity\/RBAC approval/i,
  /Backup rehearsal/i,
  /Restore rehearsal/i,
  /Rollback rehearsal/i,
  /Monitoring and alert threshold approval/i,
  /Final cutover approval/i
];

function hasAll(source, patterns) {
  return patterns.every((pattern) => pattern.test(source));
}

async function readRepositoryFiles(cwd, read) {
  const sources = {};
  const readIssues = [];

  for (const [key, relativePath] of Object.entries(requiredFiles)) {
    try {
      sources[key] = await read(path.resolve(cwd, relativePath), "utf8");
    } catch {
      sources[key] = "";
      readIssues.push(`${key}: required repository file is unavailable`);
    }
  }

  return { sources, readIssues };
}

function evaluateChecks(sources) {
  return {
    m19Closed:
      /Status:\s*CLOSED for repository-owned M19 parity remediation/i.test(sources.m19Doc) &&
      /M19:[\s\S]*CLOSED[\s\S]*repository-owned parity remediation/i.test(sources.currentStatus),
    m20Blocked:
      /M20:[\s\S]*BLOCKED[\s\S]*not started/i.test(sources.currentStatus) &&
      /M20 production execution remains BLOCKED/i.test(sources.currentStatus) &&
      /M20 remains BLOCKED/i.test(sources.m20Doc),
    productionPlaceholderSafety:
      /database_id\s*=\s*"production-placeholder"/.test(sources.wrangler) &&
      /\[env\.production\.vars\][\s\S]*ENVIRONMENT\s*=\s*"production"/.test(sources.wrangler) &&
      /\[env\.production\.vars\][\s\S]*ADMIN_WRITE_PREVIEW_ENABLED\s*=\s*"false"/.test(sources.wrangler) &&
      /\[env\.production\.vars\][\s\S]*ADMIN_WRITE_SMOKE_ENABLED\s*=\s*"false"/.test(sources.wrangler),
    appsScriptFallbackProvider:
      /provider === "cloudflare" \? "cloudflare" : "apps-script"/.test(sources.publicProvider) &&
      /Apps Script remains the fallback and rollback provider/i.test(sources.currentStatus),
    mediaBridgeBoundary: /services\/googleApi/.test(sources.mediaApi),
    m20ReadinessDocument: hasAll(sources.m20Doc, requiredM20DocSections),
    m20OperationsRunbook: hasAll(sources.m20Runbook, requiredRunbookSections),
    packageScripts:
      /"worker:m20:readiness"\s*:\s*"node cloudflare\/public-api\/scripts\/m20-readiness-gate\.mjs"/.test(
        sources.rootPackage
      ) && /"m20:readiness"\s*:\s*"node scripts\/m20-readiness-gate\.mjs"/.test(sources.workerPackage)
  };
}

function buildValidationIssues(checks, readIssues) {
  const validationIssues = [...readIssues];
  const issueByCheck = {
    m19Closed: "m19Closed: M19 closure evidence is missing",
    m20Blocked: "m20Blocked: M20 blocked/readiness-only evidence is missing",
    productionPlaceholderSafety: "productionPlaceholderSafety: production placeholder safety is missing",
    appsScriptFallbackProvider: "appsScriptFallbackProvider: Apps Script fallback provider evidence is missing",
    mediaBridgeBoundary: "mediaBridgeBoundary: media binary bridge evidence is missing",
    m20ReadinessDocument: "m20ReadinessDocument: M20 readiness document is incomplete or unavailable",
    m20OperationsRunbook: "m20OperationsRunbook: M20 operations runbook is incomplete or unavailable",
    packageScripts: "packageScripts: M20 readiness package scripts are missing"
  };

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      validationIssues.push(issueByCheck[name]);
    }
  }

  return validationIssues;
}

export async function runM20ReadinessGate(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const read = options.readFile ?? readFile;
  const { sources, readIssues } = await readRepositoryFiles(cwd, read);
  const booleanChecks = evaluateChecks(sources);
  const validationIssues = buildValidationIssues(booleanChecks, readIssues);
  const checks = Object.fromEntries(
    Object.entries(booleanChecks).map(([name, passed]) => [name, passed ? "passed" : "blocked"])
  );

  return {
    checkpoint: "M20-P0",
    status: validationIssues.length ? "BLOCKED" : "REPOSITORY_READY_FOR_M20_REVIEW",
    checks,
    externalOperatorBlockers,
    safety: {
      remoteCommandsRun: false,
      networkRequests: false,
      d1Writes: false,
      workerDeploy: false,
      vercelMutation: false,
      appsScriptMutation: false,
      googleDriveMutation: false,
      productionCutover: false
    },
    validationIssues
  };
}

export function formatM20ReadinessGate(result) {
  const lines = [result.status, "", "Repository checks:"];

  Object.entries(result.checks).forEach(([name, status]) => {
    lines.push(`- ${name}: ${status}`);
  });

  lines.push("", "External operator blockers:");
  result.externalOperatorBlockers.forEach((blocker) => lines.push(`- ${blocker}`));

  if (result.validationIssues.length) {
    lines.push("", "Repository validation issues:");
    result.validationIssues.forEach((issue) => lines.push(`- ${issue}`));
  }

  lines.push("", "No remote commands were run.");
  lines.push(
    "No network requests, D1 writes, Worker deploys, Vercel mutations, Apps Script mutations, Google Drive mutations, or production cutover actions were run."
  );
  return lines.join("\n");
}

export async function main() {
  const result = await runM20ReadinessGate();
  console.log(formatM20ReadinessGate(result));
  process.exitCode = result.status === "REPOSITORY_READY_FOR_M20_REVIEW" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
