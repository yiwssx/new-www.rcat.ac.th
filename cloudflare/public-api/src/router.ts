import type { Env } from "./env";
import { methodNotAllowed, notFound } from "./responses";
import { adminWrite } from "./routes/adminWrite";
import { health } from "./routes/health";
import { publicContentDetail, publicContentList } from "./routes/publicContent";
import { publicDocuments } from "./routes/publicDocuments";
import { publicHome } from "./routes/publicHome";
import { publicPrograms } from "./routes/publicPrograms";
import { publicSearch } from "./routes/publicSearch";
import { publicVisitorStats } from "./routes/publicVisitorStats";

const CONTENT_DETAIL_PREFIX = "/api/public/content/";

export async function routeRequest(request: Request, env: Env) {
  const adminResponse = await adminWrite(request, env);

  if (adminResponse) {
    return adminResponse;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204
    });
  }

  if (request.method !== "GET") {
    const response = methodNotAllowed();
    response.headers.set("Allow", "GET, OPTIONS");
    return response;
  }

  const { pathname } = new URL(request.url);

  if (pathname === "/health" || pathname === "/api/health") {
    return health(env);
  }

  if (pathname === "/api/public/documents") {
    return publicDocuments(env);
  }

  if (pathname === "/api/public/home") {
    return publicHome(env);
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
