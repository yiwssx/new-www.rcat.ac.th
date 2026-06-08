import type { Env } from "./env";
import { jsonError, withCors } from "./responses";
import { routeRequest } from "./router";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return withCors(await routeRequest(request, env), request, env);
    } catch {
      return withCors(jsonError("internal server error", 500), request, env);
    }
  }
};
