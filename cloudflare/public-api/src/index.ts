import type { Env } from "./env";
import { jsonError, withCors } from "./responses";
import { routeRequest } from "./router";
import { withSecurityHeaders } from "./securityHeaders";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return withSecurityHeaders(withCors(await routeRequest(request, env), request, env));
    } catch {
      return withSecurityHeaders(withCors(jsonError("internal server error", 500), request, env));
    }
  }
};
