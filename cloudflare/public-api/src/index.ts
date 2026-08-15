import { prunePublicAnalyticsData } from "./analyticsRetention";
import type { Env } from "./env";
import { logUnhandledWorkerError, resolveRequestId, withRequestId } from "./requestId";
import { jsonError, withCors } from "./responses";
import { routeRequest } from "./router";
import { withSecurityHeaders } from "./securityHeaders";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = resolveRequestId(request, env);

    try {
      return withRequestId(withSecurityHeaders(withCors(await routeRequest(request, env), request, env)), requestId);
    } catch (error) {
      logUnhandledWorkerError(request, requestId, error);
      return withRequestId(
        withSecurityHeaders(withCors(jsonError("internal server error", 500), request, env)),
        requestId
      );
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext) {
    context.waitUntil(prunePublicAnalyticsData(env));
  }
};
