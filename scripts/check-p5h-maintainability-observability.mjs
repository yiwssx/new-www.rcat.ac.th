import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const fail = (message) => {
  throw new Error(`P5H maintainability/observability boundary failed: ${message}`);
};

const pagination = read("cloudflare/public-api/src/routes/adminPagination.ts");
const menuMutations = read("cloudflare/public-api/src/routes/adminMenuMutations.ts");
const adminWrite = read("cloudflare/public-api/src/routes/adminWrite.ts");
const linkValidation = read("cloudflare/public-api/src/adminLinkValidation.ts");
const workerRequestId = read("cloudflare/public-api/src/requestId.ts");
const workerIndex = read("cloudflare/public-api/src/index.ts");
const nodeRequestId = read("server/observability/requestId.mjs");
const adminProxy = read("server/adminProxy/handlers.mjs");
const cmsDispatcher = read("server/cmsAuth/dispatcher.mjs");
const cmsUpstreamFetch = read("server/cmsAuth/upstreamFetch.mjs");
const linkAuditWorkflow = read(".github/workflows/cms-link-integrity-audit.yml");

if (!pagination.includes('import { handleAdminMenuMutation } from "./adminMenuMutations";')) {
  fail("adminPagination must delegate menu mutations to the extracted route module");
}
for (const forbidden of ["handleMenuItemMutation", "INSERT INTO menu_items", "UPDATE menu_items", "DELETE FROM menu_items"]) {
  if (pagination.includes(forbidden)) {
    fail(`adminPagination regained menu write responsibility: ${forbidden}`);
  }
}
if (Buffer.byteLength(pagination, "utf8") >= 48_000) {
  fail("adminPagination hotspot has grown back above the P5H size ceiling");
}
if (!menuMutations.includes("handleAdminMenuMutation") || !menuMutations.includes("isValidCmsLink")) {
  fail("extracted menu mutation module must own menu writes and use the central link policy");
}
if (!adminWrite.includes("await validateAdminLinkWriteRequest(request);")) {
  fail("authenticated Admin write boundary must invoke centralized CMS link validation");
}
for (const required of ["navigation", "resource", "canonical"]) {
  if (!linkValidation.includes(`"${required}"`)) {
    fail(`link policy is missing ${required} classification`);
  }
}
if (linkValidation.includes('"javascript:"') || linkValidation.includes('"data:"')) {
  fail("unsafe URL schemes must not be allowlisted");
}

for (const source of [workerRequestId, nodeRequestId]) {
  if (!source.includes("X-RCAT-Request-ID")) {
    fail("request ID header contract drifted between Vercel and Worker boundaries");
  }
}
if (!adminProxy.includes("ensureNodeRequestId") || !adminProxy.includes("RCAT_REQUEST_ID_HEADER")) {
  fail("Admin proxy must create/forward a server-owned request ID");
}
if (!cmsDispatcher.includes("ensureNodeRequestId") || !cmsDispatcher.includes("createCmsCorrelatedFetch")) {
  fail("CMS auth dispatcher must create a server-owned request ID and use the correlated upstream fetch boundary");
}
if (!cmsUpstreamFetch.includes("RCAT_REQUEST_ID_HEADER") || !cmsUpstreamFetch.includes("getNodeRequestId")) {
  fail("CMS auth correlated fetch must forward the server-owned request ID");
}
for (const boundary of ["/api/admin/", "/api/internal/cms-auth/"]) {
  if (!workerRequestId.includes(boundary)) {
    fail(`Worker request ID trust boundary is missing ${boundary}`);
  }
}
if (!workerRequestId.includes("requestProxySecret === configuredProxySecret")) {
  fail("Worker must require the exact private proxy secret before accepting upstream request IDs");
}
if ((workerIndex.match(/withRequestId\(/g) ?? []).length < 2 || !workerIndex.includes("logUnhandledWorkerError")) {
  fail("Worker success/error responses must retain request correlation");
}

if (!linkAuditWorkflow.includes("secrets.CLOUDFLARE_D1_READ_TOKEN")) {
  fail("production CMS link audit must use the dedicated D1 read token");
}
for (const forbidden of ["wrangler deploy", "migrations apply", "time-travel restore", "--file"]) {
  if (linkAuditWorkflow.includes(forbidden)) {
    fail(`CMS link audit must stay read-only: ${forbidden}`);
  }
}

console.log(
  "P5H boundary verified: menu hotspot split, deterministic CMS link validation active, request correlation preserved, production link audit read-only."
);
