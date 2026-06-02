import type { Env } from "./env";
import { methodNotAllowed, notFound } from "./responses";
import { health } from "./routes/health";
import { publicDocuments } from "./routes/publicDocuments";

export function routeRequest(request: Request, env: Env) {
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
    return publicDocuments();
  }

  return notFound();
}
