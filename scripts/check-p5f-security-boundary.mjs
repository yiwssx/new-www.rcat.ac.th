import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  throw new Error(`P5F security boundary failed: ${message}`);
};

const D1_READ_SECRET = "secrets.CLOUDFLARE_D1_READ_TOKEN";
const PRIVILEGED_SECRET = "secrets.CLOUDFLARE_API_TOKEN";

const pureReadWorkflows = [
  ".github/workflows/worker-production-preflight.yml",
  ".github/workflows/d1-recovery-drill.yml",
  ".github/workflows/p6b-production-security.yml"
];

for (const workflow of pureReadWorkflows) {
  const source = read(workflow);
  if (!source.includes(D1_READ_SECRET)) {
    fail(`${workflow} must consume the dedicated CLOUDFLARE_D1_READ_TOKEN secret`);
  }
  if (source.includes(PRIVILEGED_SECRET)) {
    fail(`${workflow} must not consume the privileged CLOUDFLARE_API_TOKEN secret`);
  }
}

const integritySource = read(".github/workflows/production-data-integrity.yml");
const integritySelector =
  "inputs.mode == 'cleanup' && secrets.CLOUDFLARE_API_TOKEN || secrets.CLOUDFLARE_D1_READ_TOKEN";
if (!integritySource.includes(integritySelector)) {
  fail(
    "Production Data Integrity must select D1 read credentials for audit mode and privileged credentials for cleanup mode"
  );
}
if (!integritySource.includes("if: ${{ inputs.mode == 'cleanup' }}")) {
  fail("Production Data Integrity must keep write steps behind the cleanup mode guard");
}

const workerReleaseSource = read(".github/workflows/worker-production.yml");
if (!workerReleaseSource.includes(PRIVILEGED_SECRET)) {
  fail("Worker Production Release must retain the privileged token for migration/deploy operations");
}
if (workerReleaseSource.includes(D1_READ_SECRET)) {
  fail("Worker Production Release must not blur the read-only token into the privileged release path");
}

const evidence = JSON.parse(read("config/csp-production-evidence.json"));
const requiredSurfaces = ["public-ssr", "public-navigation", "auth", "admin", "media", "complaint", "facebook-embed"];
const actualSurfaces = Object.keys(evidence.surfaces || {}).sort();
if (actualSurfaces.join("\n") !== [...requiredSurfaces].sort().join("\n")) {
  fail(`CSP evidence must contain exactly these seven surfaces: ${requiredSurfaces.join(", ")}`);
}

const allowedEvidenceStates = new Set(["pending", "blocked", "clean"]);
for (const surface of requiredSurfaces) {
  const record = evidence.surfaces[surface];
  if (!allowedEvidenceStates.has(record?.state)) {
    fail(`${surface} has an invalid CSP evidence state`);
  }
  if (typeof record?.representativePath !== "string" || !record.representativePath.startsWith("/")) {
    fail(`${surface} must define a representative production path`);
  }
  if (!Array.isArray(record?.evidence) || record.evidence.length === 0) {
    fail(`${surface} must record positive evidence; absence of retained logs is not evidence`);
  }
}

const readiness = JSON.parse(read("config/csp-enforcement-readiness.json"));
const enforcementApproved = readiness.approvedForEnforcement === true;
if (readiness.approvedForEnforcement !== false && !enforcementApproved) {
  fail("CSP enforcement approval must be an explicit boolean");
}

if (enforcementApproved) {
  const allSurfacesClean = requiredSurfaces.every((surface) => readiness.surfaces?.[surface] === "clean");
  if (!allSurfacesClean || !readiness.reviewedAt || !readiness.rollbackOwner) {
    fail("P6B enforcement requires clean production evidence, review time, and rollback ownership");
  }
}

const vercel = JSON.parse(read("vercel.json"));
const responseHeaders = (vercel.headers || []).flatMap((entry) => entry.headers || []);
const reportOnlyHeaders = responseHeaders.filter(
  (header) => String(header.key).toLowerCase() === "content-security-policy-report-only"
);
const enforcingHeaders = responseHeaders.filter(
  (header) => String(header.key).toLowerCase() === "content-security-policy"
);

if (!enforcementApproved) {
  if (reportOnlyHeaders.length === 0) {
    fail("Content-Security-Policy-Report-Only must remain enabled during P5F evidence collection");
  }
  if (enforcingHeaders.length > 0) {
    fail("P5F must not switch CSP to enforcement before explicit P6B approval");
  }
} else if (enforcingHeaders.length === 0) {
  fail("approved P6B CSP enforcement requires an enforcing Content-Security-Policy header");
}

for (const header of [...reportOnlyHeaders, ...enforcingHeaders]) {
  const policy = String(header.value || "");
  if (!policy.includes("report-uri /api/csp-report")) {
    fail("CSP must continue reporting to /api/csp-report");
  }
  if (policy.includes("'unsafe-eval'")) {
    fail("CSP must not be weakened with unsafe-eval");
  }
  if (/frame-src[^;]*\shttps:\s*(?:;|$)/.test(policy)) {
    fail("frame-src must not be broadened to the entire https scheme");
  }
  if (/script-src[^;]*\shttps:\s*(?:;|$)/.test(policy)) {
    fail("script-src must not be broadened to the entire https scheme");
  }
}

const counts = requiredSurfaces.reduce(
  (summary, surface) => {
    summary[evidence.surfaces[surface].state] += 1;
    return summary;
  },
  { clean: 0, blocked: 0, pending: 0 }
);

console.log(
  `P5F security boundary: dedicated D1 read paths verified; CSP evidence ${counts.clean} clean / ${counts.blocked} blocked / ${counts.pending} pending; enforcement ${enforcementApproved ? "approved by P6B evidence" : "remains off"}.`
);
