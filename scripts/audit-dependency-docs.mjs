import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FORBIDDEN_SYNCHRONOUS_TELEMETRY_MODULES, PUBLIC_PERFORMANCE_BUDGET } from "./public-performance-budget.mjs";

const ROOT = process.cwd();
const DOCUMENTS = Object.freeze({
  governance: "docs/maintenance/dependencies.md",
  status: "docs/maintenance/dependency-current-status.md",
  performance: "docs/performance/performance-governance-and-analytics.md"
});
const INPUTS = Object.freeze({
  packageJson: "package.json",
  lockfile: "pnpm-lock.yaml",
  workspace: "pnpm-workspace.yaml",
  policy: "config/dependency-policy.json"
});
const REMOVED_REFERENCES = Object.freeze([
  ["DEPENDENCY", "MIGRATION.md"].join("-"),
  ["MIGRATE", "DEPENDENCIES.ps1"].join("-"),
  ["dependency", "waves.json"].join("-"),
  ["scripts/dependency", "migration.mjs"].join("-"),
  ["dependency", "migration-runbook.md"].join("-"),
  ["dependency", "modernization.md"].join("-"),
  ["dependency", "major-update-plan.md"].join("-"),
  ["dependency", "doc-reference-audit.md"].join("-")
]);
const ROOT_POLICY_REFERENCE = ["dependency", "policy.json"].join("-");
const REMOVED_RELEASE_AGE_STATUS = ["Validated", "release-age", "hold"].join(" ");
const REQUIRED_GOVERNANCE_SECTIONS = Object.freeze([
  "Purpose and scope",
  "Stable-release selection policy",
  "Compatibility exceptions",
  "Direct dependency and lockfile policy",
  "Security audit thresholds",
  "Security update response policy",
  "Strict peer dependency policy",
  "Runtime and type declaration alignment",
  "TypeScript and typescript-eslint alignment",
  "Node and @types/node alignment",
  "React and React DOM alignment",
  "MUI and Emotion alignment",
  "Vite, Vitest, and jsdom alignment",
  "Cloudflare Worker tooling alignment",
  "Supply-chain minimum release age",
  "Install-time build-script allowlist",
  "Patch and minor update procedure",
  "Major migration procedure",
  "Required CI gates",
  "Rollback procedure",
  "Documentation update procedure"
]);
const REQUIRED_PERFORMANCE_SECTIONS = Object.freeze([
  "Telemetry ownership",
  "Public, Auth, and Admin boundaries",
  "Data minimization",
  "Deterministic measurement method",
  "Current performance budget",
  "Forbidden synchronous telemetry associations",
  "Accepted reviewed performance rebaseline",
  "CI commands",
  "Reproduction",
  "Current limitations"
]);
const ALLOWED_DEPENDENCY_STATUSES = new Set([
  "Registry latest",
  "Pending release-age eligibility",
  "Validated compatibility exception",
  "Outdated",
  "Registry error",
  "Missing installation",
  "Invalid manifest",
  "Invalid exception"
]);
const ALLOWED_AUDIT_STATUSES = new Set(["PASS", "FAIL", "ERROR"]);
const THAI_TEXT = /[\u0e00-\u0e7f]/u;
const errorsByDocument = new Map(Object.values(DOCUMENTS).map((path) => [path, []]));

function documentErrors(path) {
  return errorsByDocument.get(path);
}

function record(path, passed, reason) {
  if (!passed) {
    documentErrors(path).push(reason);
  }
}

function absolutePath(path) {
  return resolve(ROOT, path);
}

function readRequired(path) {
  if (!existsSync(absolutePath(path))) {
    record(path, false, "file is missing");
    return "";
  }
  return readFileSync(absolutePath(path), "utf8");
}

function hashFile(path) {
  const canonicalText = readFileSync(absolutePath(path), "utf8").replaceAll("\r\n", "\n");
  return createHash("sha256").update(canonicalText).digest("hex");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function hasHeading(content, heading) {
  return new RegExp(`^##(?:\\s+\\d+\\.)?\\s+${escapeRegex(heading)}\\s*$`, "mu").test(content);
}

function validateCanonicalHeader(path, content, title) {
  record(path, new RegExp(`^# ${escapeRegex(title)}$`, "mu").test(content), `title must be "# ${title}"`);
  record(path, /^- Document status: active$/mu.test(content), "Document status must be active");
  record(path, /^- Canonical: true$/mu.test(content), "Canonical must be true");
  record(path, !THAI_TEXT.test(content), "technical documentation must be entirely in English");
}

function markdownCells(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().replaceAll("\\|", "|"));
}

function validateGovernanceDocument(content) {
  const path = DOCUMENTS.governance;
  validateCanonicalHeader(path, content, "Dependency Governance");

  for (const [index, section] of REQUIRED_GOVERNANCE_SECTIONS.entries()) {
    record(path, content.includes(`## ${index + 1}. ${section}`), `missing required section "${section}"`);
  }

  record(path, content.includes("config/dependency-policy.json"), "must reference the relocated compatibility policy");
  record(
    path,
    content.includes("pnpm install --frozen-lockfile --strict-peer-dependencies"),
    "must retain the frozen strict-peer install command"
  );
  record(path, content.includes("minimumReleaseAge: 4320"), "must retain the three-day release-age policy");
  record(
    path,
    /live registry monitoring is separate from blocking\s+push and pull-request CI/iu.test(content),
    "must separate live registry monitoring from blocking push and pull-request CI"
  );
  record(path, !content.includes(REMOVED_RELEASE_AGE_STATUS), "must not define an obsolete age-based passing status");
  for (const packageName of ["esbuild", "sharp", "workerd"]) {
    record(path, content.includes(`\`${packageName}\``), `must retain ${packageName} in the build-script allowlist`);
  }
}

function validateStatusHashes(path, content) {
  for (const [label, inputPath] of Object.entries(INPUTS)) {
    record(path, existsSync(absolutePath(inputPath)), `${inputPath} is missing`);
    if (!existsSync(absolutePath(inputPath))) {
      continue;
    }
    const markerName =
      label === "packageJson"
        ? "package-json-sha256"
        : label === "lockfile"
          ? "pnpm-lock-sha256"
          : label === "workspace"
            ? "pnpm-workspace-sha256"
            : "dependency-policy-sha256";
    const marker = content.match(new RegExp(`${markerName}:\\s*([a-f0-9]{64}|missing)`, "u"))?.[1];
    const current = hashFile(inputPath);
    record(path, marker === current, `${inputPath} hash is stale`);
  }
}

function validateSecurityAuditTable(path, content) {
  const auditSection = content.match(/## Security audit\s+([\s\S]*?)(?=\n## |\s*$)/u)?.[1] || "";
  const rows = auditSection
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*(?:Full tree|Production)\s*\|/u.test(line))
    .map(markdownCells);

  record(path, rows.length === 2, "security audit table must contain Full tree and Production rows");
  for (const cells of rows) {
    const [scope, status, low, moderate, high, critical, exitCode] = cells;
    record(path, ALLOWED_AUDIT_STATUSES.has(status), `${scope} audit has invalid status "${status}"`);
    record(path, status === "PASS", `${scope} audit is not PASS`);
    record(
      path,
      [low, moderate, high, critical].every((value) => /^\d+$/u.test(value)),
      `${scope} audit counts are invalid`
    );
    record(path, /^\d+$/u.test(exitCode), `${scope} audit exit code is invalid`);
  }
}

function validateDependencyMatrix(path, content) {
  const matrixSection = content.match(/## Direct dependency matrix\s+([\s\S]*?)(?=\n## |\s*$)/u)?.[1] || "";
  const lines = matrixSection.split(/\r?\n/u);
  const headers = markdownCells(lines.find((line) => /^\|\s*Package\s*\|/u.test(line)) || "");
  const requiredHeaders = ["Package", "Section", "Manifest", "Installed", "Registry latest", "Status", "Reason"];
  for (const header of requiredHeaders) {
    record(path, headers.includes(header), `direct dependency matrix is missing the "${header}" column`);
  }
  const statusIndex = headers.indexOf("Status");
  const rows = lines.filter((line) => /^\|\s*`[^`]+`\s*\|/u.test(line)).map(markdownCells);

  record(path, rows.length > 0, "direct dependency matrix has no package rows");
  for (const cells of rows) {
    const packageName = cells[0]?.replaceAll("`", "") || "unknown";
    const status = statusIndex >= 0 ? cells[statusIndex] || "" : "";
    record(path, ALLOWED_DEPENDENCY_STATUSES.has(status), `${packageName} has invalid status "${status}"`);
  }
}

function validateStatusDocument(content) {
  const path = DOCUMENTS.status;
  validateCanonicalHeader(path, content, "Dependency Status");
  validateStatusHashes(path, content);

  record(
    path,
    /^- Generated at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/mu.test(content),
    "Generated at must be an ISO 8601 Asia/Bangkok timestamp"
  );
  record(path, /^- Registry lookup: PASS \(\d+ direct dependencies\)$/mu.test(content), "registry lookup must be PASS");
  record(path, /^- Direct dependencies: \d+$/mu.test(content), "direct dependency count is missing");
  record(path, /^- Accepted by live monitoring policy: \d+$/mu.test(content), "accepted dependency count is missing");
  record(path, !content.includes(REMOVED_RELEASE_AGE_STATUS), "must not contain an obsolete age-based passing status");
  for (const heading of ["Security audit", "Direct dependency matrix", "Interpretation"]) {
    record(path, hasHeading(content, heading), `missing required section "${heading}"`);
  }

  validateSecurityAuditTable(path, content);
  validateDependencyMatrix(path, content);
}

function budgetRowMatches(content, label, value) {
  return new RegExp(
    `^\\| ${escapeRegex(label)}\\s+\\|\\s+${String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}\\s+\\|$`,
    "mu"
  ).test(content);
}

function validatePerformanceDocument(content) {
  const path = DOCUMENTS.performance;
  validateCanonicalHeader(path, content, "Performance Governance and Analytics");

  for (const heading of REQUIRED_PERFORMANCE_SECTIONS) {
    record(path, hasHeading(content, heading), `missing required section "${heading}"`);
  }

  const budgetRows = [
    ["Synchronous JavaScript files", PUBLIC_PERFORMANCE_BUDGET.javascriptFiles],
    ["Synchronous JavaScript raw bytes", PUBLIC_PERFORMANCE_BUDGET.rawBytes],
    ["Synchronous JavaScript gzip bytes", PUBLIC_PERFORMANCE_BUDGET.gzipBytes],
    ["Forbidden synchronous telemetry associations", 0]
  ];
  for (const [label, value] of budgetRows) {
    record(path, budgetRowMatches(content, label, value), `${label} does not match the committed budget`);
  }
  for (const modulePath of FORBIDDEN_SYNCHRONOUS_TELEMETRY_MODULES) {
    record(path, content.includes(`\`${modulePath}\``), `missing forbidden module association ${modulePath}`);
  }

  for (const command of [
    "pnpm exec vitest run scripts/public-performance-budget.test.mjs",
    "pnpm build",
    "pnpm perf:check",
    "pnpm test:functional"
  ]) {
    record(path, content.includes(command), `missing CI or reproduction command "${command}"`);
  }
  record(
    path,
    content.toLowerCase().includes("accepted reviewed performance rebaseline"),
    "must describe the accepted reviewed performance rebaseline"
  );
  record(
    path,
    !/\bNo performance regression\b/iu.test(content),
    "must not claim that there was no performance regression"
  );
}

function validateRemovedReferences(contents) {
  for (const [path, content] of contents) {
    for (const reference of REMOVED_REFERENCES) {
      record(path, !content.includes(reference), `contains removed reference "${reference}"`);
    }
    record(
      path,
      !content
        .split(/\r?\n/u)
        .some((line) => line.includes(ROOT_POLICY_REFERENCE) && !line.includes(`config/${ROOT_POLICY_REFERENCE}`)),
      `contains the obsolete root policy path "${ROOT_POLICY_REFERENCE}"`
    );
  }
}

const contents = new Map(Object.values(DOCUMENTS).map((path) => [path, readRequired(path)]));
validateGovernanceDocument(contents.get(DOCUMENTS.governance));
validateStatusDocument(contents.get(DOCUMENTS.status));
validatePerformanceDocument(contents.get(DOCUMENTS.performance));
validateRemovedReferences(contents);

console.log("Dependency documentation audit:");
let errorCount = 0;
for (const [path, errors] of errorsByDocument) {
  errorCount += errors.length;
  console.log(`- ${path}: ${errors.length === 0 ? "PASS" : `FAIL (${errors.length})`}`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
}
console.log(`Dependency documentation audit result: ${errorCount === 0 ? "PASS" : `FAIL (${errorCount} error(s))`}`);

if (errorCount > 0) {
  process.exitCode = 1;
}
