import type { Env } from "./env";
import { jsonError, methodNotAllowed, notFound } from "./responses";
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

const CONTENT_DETAIL_PREFIX = "/api/public/content/";

export async function routeRequest(request: Request, env: Env) {
  const cmsAuthResponse = await handleCmsAuthInternal(request, env);

  if (cmsAuthResponse) {
    return cmsAuthResponse;
  }

  const { pathname } = new URL(request.url);

  // The current Admin UI uses revision-aware item/order endpoints. The legacy
  // whole-tree replacement can erase or overwrite concurrent menu changes, so
  // it is intentionally unavailable in production while remaining usable by
  // historical preview parity tooling.
  if (env.ENVIRONMENT === "production" && request.method === "PUT" && pathname === "/api/admin/menu") {
    return jsonError("bulk menu replacement is retired; use revision-aware menu item and order endpoints", 405);
  }

  const adminResponse = await adminWrite(request, env);

  if (adminResponse) {
    return adminResponse;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204
    });
  }

  if (request.method === "POST" && pathname === "/api/public/site-view") {
    return recordPublicSiteView(request, env);
  }

  if (request.method === "POST" && pathname === "/api/public/presence") {
    return recordPublicPresence(request, env);
  }

  if (request.method === "POST" && pathname === "/api/public/content-view") {
    return recordPublicContentView(request, env);
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
