import { isPublicAnalyticsOriginAllowed } from "./cors";
import type { Env } from "./env";
import { invalidatePublicReadCacheAfterAdminMutation } from "./publicReadCacheInvalidation";
import { jsonError, methodNotAllowed, notFound } from "./responses";
import { handleAdminBackupRecovery } from "./routes/adminBackupRecovery";
import { handleAdminContentGovernance } from "./routes/adminContentGovernance";
import { enforceAdminContentScope, handleAdminCmsGapClosure } from "./routes/adminCmsGapClosure";
import { handleAdminEditorialGovernance } from "./routes/adminEditorialGovernance";
import { adminWrite } from "./routes/adminWrite";
import { health } from "./routes/health";
import { publicContentDetail, publicContentList } from "./routes/publicContent";
import { publicDocuments } from "./routes/publicDocuments";
import { publicEvents } from "./routes/publicEvents";
import { publicHome } from "./routes/publicHome";
import { publicPrograms } from "./routes/publicPrograms";
import { publicSearch } from "./routes/publicSearch";
import { publicShell } from "./routes/publicShell";
import { publicVisitorStats } from "./routes/publicVisitorStats";
import { recordPublicContentView, recordPublicPresence, recordPublicSiteView } from "./routes/publicAnalytics";
import { handleCmsAuthInternal } from "./routes/cmsAuthInternal";
import { handleAdminRuntimeIncidents, recordRuntimeIncident } from "./routes/runtimeIncidents";

const CONTENT_DETAIL_PREFIX = "/api/public/content/";

function rejectUntrustedPublicAnalyticsOrigin(request: Request, env: Env, resource: string) {
  return isPublicAnalyticsOriginAllowed(request, env)
    ? null
    : jsonError("origin is not allowed", 403, { resource, diagnostic: "public-analytics-origin-denied-v1" });
}

async function finalizeAdminResponse(request: Request, env: Env, response: Response) {
  try {
    await invalidatePublicReadCacheAfterAdminMutation(request, env, response);
  } catch (error) {
    console.warn("post-write public cache invalidation failed", {
      errorName: error instanceof Error ? error.name : "Error"
    });
  }
  return response;
}

export async function routeRequest(request: Request, env: Env) {
  const cmsAuthResponse = await handleCmsAuthInternal(request, env);

  if (cmsAuthResponse) {
    return cmsAuthResponse;
  }

  const { pathname } = new URL(request.url);
  const runtimeIncidentAdminResponse = await handleAdminRuntimeIncidents(request, env);

  if (runtimeIncidentAdminResponse) {
    return runtimeIncidentAdminResponse;
  }

  // The current Admin UI uses revision-aware item/order endpoints. The legacy
  // whole-tree replacement can erase or overwrite concurrent menu changes, so
  // it is intentionally unavailable in production while remaining usable by
  // historical preview parity tooling.
  if (env.ENVIRONMENT === "production" && request.method === "PUT" && pathname === "/api/admin/menu") {
    return jsonError("bulk menu replacement is retired; use revision-aware menu item and order endpoints", 405);
  }

  // Scoped editors keep the existing role/capabilities while write access is
  // constrained to content whose owner matches their optional account scope.
  const contentScopeResponse = await enforceAdminContentScope(request, env);

  if (contentScopeResponse) {
    contentScopeResponse.headers.set("Cache-Control", "no-store");
    return contentScopeResponse;
  }

  // Recovery is intercepted before the broader gap-closure handler so merge
  // restores use primary-key UPSERT semantics and never REPLACE unrelated rows.
  const backupRecoveryResponse = await handleAdminBackupRecovery(request, env);

  if (backupRecoveryResponse) {
    return finalizeAdminResponse(request, env, backupRecoveryResponse);
  }

  const gapClosureResponse = await handleAdminCmsGapClosure(request, env);

  if (gapClosureResponse) {
    return finalizeAdminResponse(request, env, gapClosureResponse);
  }

  const editorialGovernanceResponse = await handleAdminEditorialGovernance(request, env);

  if (editorialGovernanceResponse) {
    return finalizeAdminResponse(request, env, editorialGovernanceResponse);
  }

  const governanceResponse = await handleAdminContentGovernance(request, env);

  if (governanceResponse) {
    return finalizeAdminResponse(request, env, governanceResponse);
  }

  const adminResponse = await adminWrite(request, env);

  if (adminResponse) {
    return finalizeAdminResponse(request, env, adminResponse);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204
    });
  }

  if (request.method === "POST" && pathname === "/api/public/site-view") {
    const denied = rejectUntrustedPublicAnalyticsOrigin(request, env, "site-view");
    return denied ?? recordPublicSiteView(request, env);
  }

  if (request.method === "POST" && pathname === "/api/public/presence") {
    const denied = rejectUntrustedPublicAnalyticsOrigin(request, env, "presence");
    return denied ?? recordPublicPresence(request, env);
  }

  if (request.method === "POST" && pathname === "/api/public/content-view") {
    const denied = rejectUntrustedPublicAnalyticsOrigin(request, env, "content-view");
    return denied ?? recordPublicContentView(request, env);
  }

  if (request.method === "POST" && pathname === "/api/public/runtime-incident") {
    const denied = rejectUntrustedPublicAnalyticsOrigin(request, env, "runtime-incident");
    return denied ?? recordRuntimeIncident(request, env);
  }

  if (request.method !== "GET") {
    const response = methodNotAllowed();
    response.headers.set("Allow", "GET, OPTIONS");
    return response;
  }

  if (pathname === "/health" || pathname === "/api/health") {
    return health(env);
  }

  if (pathname === "/api/public/documents") {
    return publicDocuments(env);
  }

  if (pathname === "/api/public/events") {
    return publicEvents(env);
  }

  if (pathname === "/api/public/home") {
    return publicHome(env);
  }

  if (pathname === "/api/public/shell") {
    return publicShell(env);
  }

  if (pathname === "/api/public/content") {
    return publicContentList(request, env);
  }

  if (pathname.startsWith(CONTENT_DETAIL_PREFIX) && pathname.length > CONTENT_DETAIL_PREFIX.length) {
    return publicContentDetail(env, decodeURIComponent(pathname.slice(CONTENT_DETAIL_PREFIX.length)));
  }

  if (pathname === "/api/public/search") {
    return publicSearch(request, env);
  }

  if (pathname === "/api/public/programs") {
    return publicPrograms(env);
  }

  if (pathname === "/api/public/visitor-stats") {
    return publicVisitorStats(env);
  }

  return notFound();
}
