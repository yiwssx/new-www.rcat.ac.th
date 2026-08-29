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

const waf = await readFile(new URL("./apply-p6b-cloudflare-security.mjs", import.meta.url), "utf8");
if (!waf.includes("http_request_firewall_custom") || !waf.includes("http_ratelimit")) {
  fail("Cloudflare WAF/rate-limit reconciliation is incomplete");
}
if (!waf.includes("/api/cms-auth/") || !waf.includes("/api/admin-proxy")) {
  fail("sensitive auth/admin API rate-limit scope is incomplete");
}

const securityWorkflow = await readFile(
  new URL("../.github/workflows/p6b-production-security.yml", import.meta.url),
  "utf8"
);
if (!securityWorkflow.includes("check-production-auth-security-events.mjs")) {
  fail("auth anomaly monitoring is not wired into production security workflow");
}

if (enforcing) {
  const readiness = JSON.parse(
    await readFile(new URL("../config/csp-enforcement-readiness.json", import.meta.url), "utf8")
  );
  const clean = Object.values(readiness.surfaces || {}).every((status) => status === "clean");
  if (
    readiness.approvedForEnforcement !== true ||
    !clean ||
    !readiness.reviewedAt ||
    !readiness.rollbackOwner
  ) {
    fail("enforcing CSP requires approved, clean readiness evidence and rollback ownership");
  }
}

if (!process.exitCode) {
  console.log(`P6B security enforcement: ${enforcing ? "enforcing" : "report-only candidate"} contract PASS.`);
}
