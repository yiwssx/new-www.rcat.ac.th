import { readFile } from "node:fs/promises";

const REQUIRED_SURFACES = [
  "public-ssr",
  "public-navigation",
  "auth",
  "admin",
  "media",
  "complaint",
  "facebook-embed"
];

function fail(message) {
  console.error(`CSP enforcement readiness: ${message}`);
  process.exitCode = 1;
}

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

const vercelConfig = await readJson("vercel.json");
const readiness = await readJson("config/csp-enforcement-readiness.json");
const allRoutes = vercelConfig.headers?.find((entry) => entry.source === "/(.*)");
const reportOnly = allRoutes?.headers?.find((header) => header.key === "Content-Security-Policy-Report-Only")?.value;
const enforcing = allRoutes?.headers?.find((header) => header.key === "Content-Security-Policy")?.value;

if (!allRoutes) {
  fail("missing the global Vercel header block");
} else if (!reportOnly && !enforcing) {
  fail("neither report-only nor enforcing CSP is configured");
}

if (reportOnly && !reportOnly.includes("report-uri /api/csp-report")) {
  fail("report-only CSP must keep the sanitized /api/csp-report collector");
}

if (readiness?.schemaVersion !== 1 || typeof readiness?.surfaces !== "object" || readiness.surfaces === null) {
  fail("readiness evidence has an unsupported shape");
}

const unknownSurfaces = Object.keys(readiness?.surfaces ?? {}).filter((surface) => !REQUIRED_SURFACES.includes(surface));
if (unknownSurfaces.length > 0) {
  fail(`unexpected evidence surfaces: ${unknownSurfaces.join(", ")}`);
}

for (const surface of REQUIRED_SURFACES) {
  const status = readiness?.surfaces?.[surface];
  if (!new Set(["pending", "clean"]).has(status)) {
    fail(`surface ${surface} must be either pending or clean`);
  }
}

const cleanSurfaces = REQUIRED_SURFACES.filter((surface) => readiness?.surfaces?.[surface] === "clean");

if (enforcing) {
  const allClean = cleanSurfaces.length === REQUIRED_SURFACES.length;
  const reviewedAt = typeof readiness.reviewedAt === "string" && Number.isFinite(Date.parse(readiness.reviewedAt));
  const rollbackOwner = typeof readiness.rollbackOwner === "string" && readiness.rollbackOwner.trim().length > 0;

  if (readiness.approvedForEnforcement !== true || !allClean || !reviewedAt || !rollbackOwner) {
    fail(
      "enforcing CSP requires explicit approval, clean evidence for every representative surface, reviewedAt, and rollbackOwner"
    );
  }
}

if (!process.exitCode) {
  const mode = enforcing ? "enforcing" : "report-only";
  console.log(
    `CSP enforcement readiness: ${mode}; representative evidence ${cleanSurfaces.length}/${REQUIRED_SURFACES.length} clean.`
  );
}
