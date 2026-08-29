import { readFile } from "node:fs/promises";

function fail(message) {
  console.error(`P6B security enforcement: ${message}`);
  process.exitCode = 1;
}

const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const globalHeaders = vercel.headers?.find((entry) => entry.source === "/(.*)")?.headers || [];
const reportOnly = globalHeaders.find((header) => header.key === "Content-Security-Policy-Report-Only")?.value;
const enforcing = globalHeaders.find((header) => header.key === "Content-Security-Policy")?.value;
const policy = enforcing || reportOnly || "";

for (const required of [
  "https://www.googletagmanager.com",
  "https://www.youtube-nocookie.com",
  "https://www.google.com",
  "https://drive.google.com",
  "report-uri /api/csp-report"
]) {
  if (!policy.includes(required)) fail(`CSP is missing required source ${required}`);
}

if (!reportOnly && !enforcing) fail("CSP header is missing");

const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../src/routes.tsx", import.meta.url), "utf8");
const server = await readFile(new URL("../src/entry-server.tsx", import.meta.url), "utf8");

if (!runtime.includes("cspNonce")) fail("runtime does not propagate a CSP nonce");
if (!routes.includes("ssr: cspNonce ? { nonce: cspNonce } : undefined")) {
  fail("TanStack Router SSR nonce is not configured");
}
if (!server.includes("buildContentSecurityPolicy({ scriptNonce: cspNonce })")) {
  fail("SSR response does not emit the nonce-aware CSP");
}

const middleware = await readFile(new URL("../middleware.ts", import.meta.url), "utf8");
const edgeWaf = await readFile(new URL("../server/security/edgeWafPolicy.ts", import.meta.url), "utf8");
if (!middleware.includes('from "@vercel/functions"') || !middleware.includes("evaluateP6bEdgeWaf")) {
  fail("Vercel routing middleware WAF is not wired");
}
for (const required of ["/api/internal", "/api/cms-auth", "/api/admin-proxy", "p6b-vercel-v1"]) {
  if (!edgeWaf.includes(required)) fail(`Vercel edge WAF is missing ${required}`);
}

const workerRateLimit = await readFile(
  new URL("../cloudflare/public-api/src/securityRateLimit.ts", import.meta.url),
  "utf8"
);
const workerEnv = await readFile(new URL("../cloudflare/public-api/src/env.ts", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../cloudflare/public-api/wrangler.toml", import.meta.url), "utf8");
const cmsAuth = await readFile(
  new URL("../cloudflare/public-api/src/routes/cmsAuthInternal.ts", import.meta.url),
  "utf8"
);
const adminWrite = await readFile(
  new URL("../cloudflare/public-api/src/routes/adminWrite.ts", import.meta.url),
  "utf8"
);

for (const binding of ["CMS_AUTH_RATE_LIMITER", "ADMIN_API_RATE_LIMITER"]) {
  if (!workerEnv.includes(binding) || !wrangler.includes(`name = "${binding}"`)) {
    fail(`Worker rate-limit binding ${binding} is incomplete`);
  }
}
if (!workerRateLimit.includes("X-RCAT-CMS-Client-IP") || !workerRateLimit.includes('digest("SHA-256"')) {
  fail("Worker sensitive-route rate-limit keys are not derived from hashed trusted proxy metadata");
}
if (!cmsAuth.includes('enforceSecurityRateLimit(request, env, "cms-auth")')) {
  fail("CMS authentication route is missing Worker rate limiting");
}
if (!adminWrite.includes('enforceSecurityRateLimit(request, env, "admin-api")')) {
  fail("Admin API route is missing Worker rate limiting");
}

const securityWorkflow = await readFile(
  new URL("../.github/workflows/p6b-production-security.yml", import.meta.url),
  "utf8"
);
const anomalyGuard = await readFile(new URL("./check-production-auth-security-events.mjs", import.meta.url), "utf8");
if (!securityWorkflow.includes("p6b-edge-waf-production-smoke.mjs")) {
  fail("Vercel edge WAF production smoke is not wired into the production guard");
}
if (!securityWorkflow.includes("check-production-auth-security-events.mjs")) {
  fail("auth anomaly monitoring is not wired into the production security workflow");
}
if (!anomalyGuard.includes("RCAT_PRODUCTION_D1_DATABASE_ID") || !anomalyGuard.includes("admin_mfa_challenges")) {
  fail("auth anomaly monitoring is not aligned with the authoritative D1 auth runtime");
}
if (anomalyGuard.includes("clientRequestPath") || anomalyGuard.includes("firewallEventsAdaptive")) {
  fail("auth anomaly monitoring must not depend on browser-edge zone telemetry");
}

if (enforcing) {
  const readiness = JSON.parse(
    await readFile(new URL("../config/csp-enforcement-readiness.json", import.meta.url), "utf8")
  );
  const clean = Object.values(readiness.surfaces || {}).every((status) => status === "clean");
  if (readiness.approvedForEnforcement !== true || !clean || !readiness.reviewedAt || !readiness.rollbackOwner) {
    fail("enforcing CSP requires approved, clean readiness evidence and rollback ownership");
  }
}

if (!process.exitCode) {
  console.log(`P6B security enforcement: ${enforcing ? "enforcing" : "report-only candidate"} contract PASS.`);
}
