import type { Env } from "./env";
import { methodNotAllowed, notFound } from "./responses";
import { health } from "./routes/health";
import { publicDocuments } from "./routes/publicDocuments";
import { getM17SkeletonResource } from "./routes/publicReadRegistry";
import { publicReadNotImplemented } from "./routes/publicReadSkeleton";

export async function routeRequest(request: Request, env: Env) {
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

  const m17SkeletonResource = getM17SkeletonResource(pathname);

  if (m17SkeletonResource) {
    return publicReadNotImplemented(m17SkeletonResource);
  }

  return notFound();
}
