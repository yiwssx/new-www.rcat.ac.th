/* global console, process */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const futureProductionResponsibilities = [
  "final production identity and RBAC approval",
  "production-grade backup and restore policy",
  "production monitoring, alerting, and support ownership",
  "production Worker, D1, and frontend resource decisions",
  "final production cutover authority"
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
  /M20 preview-backed field cutover/i,
  /Non-goals/i,
  /Production safety boundaries/i,
  /External operator blockers/i,
  /Operator decision dispositions/i,
  /Required evidence format/i,
  /Required rehearsal flow/i,
  /Backup \/ restore \/ rollback expectations/i,
  /Cutover authority requirements/i,
  /Go \/ No-Go checklist/i,
  /Rollback checklist/i,
  /Redacted evidence policy/i
];

const requiredRunbookSections = [
  /M20 preview-backed field cutover/i,
  /Provider boundary/i,
  /Preconditions/i,
  /Field-cutover steps/i,
  /Field observation/i,
  /Operator-decision dispositions/i,
  /After field verification/i,
  /Redaction rules/i
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
    m20FieldCutoverApproved:
      /M20:\s*`APPROVED_FOR_PREVIEW_BACKED_FIELD_VERIFICATION`/i.test(sources.currentStatus) &&
      /APPROVED_FOR_PREVIEW_BACKED_FIELD_VERIFICATION/i.test(sources.m20Doc) &&
      /APPROVED_FOR_PREVIEW_FIELD_VERIFICATION_ONLY/i.test(sources.m20Doc),
    productionPlaceholderSafety:
      /database_id\s*=\s*"production-placeholder"/.test(sources.wrangler) &&
      /\[env\.production\.vars\][\s\S]*ENVIRONMENT\s*=\s*"production"/.test(sources.wrangler) &&
      /\[env\.production\.vars\][\s\S]*ADMIN_WRITE_PREVIEW_ENABLED\s*=\s*"false"/.test(sources.wrangler) &&
      /\[env\.production\.vars\][\s\S]*ADMIN_WRITE_SMOKE_ENABLED\s*=\s*"false"/.test(sources.wrangler),
    providerAssignment:
      /Admin structured data provider: Cloudflare/i.test(sources.currentStatus) &&
      /Public client data provider: Cloudflare/i.test(sources.currentStatus) &&
      /Database environment: preview D1 during field verification/i.test(sources.currentStatus),
    mediaBridgeBoundary:
      /services\/googleApi/.test(sources.mediaApi) &&
      /Media\/attachment\/file provider: Google Drive via Apps Script bridge/i.test(sources.currentStatus) &&
      /EXCLUDED_FROM_CLOUDFLARE_CUTOVER/i.test(sources.m20Doc),
    productionDeferred:
      /Production D1 \/ final production cutover: explicitly deferred to operator decision after field verification/i.test(
        sources.currentStatus
      ) && /does not claim final production readiness/i.test(sources.m20Doc),
    publicProviderSafety: /provider === "cloudflare" \? "cloudflare" : "apps-script"/.test(sources.publicProvider),
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
    m20FieldCutoverApproved: "m20FieldCutoverApproved: operator-approved preview field-cutover evidence is missing",
    productionPlaceholderSafety: "productionPlaceholderSafety: production placeholder safety is missing",
    providerAssignment: "providerAssignment: M20 field-cutover provider assignment is missing",
    mediaBridgeBoundary: "mediaBridgeBoundary: media binary bridge evidence is missing",
    productionDeferred: "productionDeferred: final production deferral evidence is missing",
    publicProviderSafety: "publicProviderSafety: provider safety invariant is missing",
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
    checkpoint: "M20",
    status: validationIssues.length ? "BLOCKED" : "REPOSITORY_ALIGNED_FOR_M20_PREVIEW_FIELD_CUTOVER",
    checks,
    futureProductionResponsibilities,
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

  lines.push("", "Future production responsibilities:");
  result.futureProductionResponsibilities.forEach((item) => lines.push(`- ${item}`));

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
  process.exitCode = result.status === "REPOSITORY_ALIGNED_FOR_M20_PREVIEW_FIELD_CUTOVER" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
