import { prunePublicAnalyticsData } from "./analyticsRetention";
import type { Env } from "./env";
import {
  isPublicReadCacheEligible,
  readPublicReadCache,
  storePublicReadCache,
  withPublicReadCacheStatus
} from "./publicReadCache";
import { logUnhandledWorkerError, resolveRequestId, withRequestId } from "./requestId";
import { jsonError, withCors } from "./responses";
import { routeRequest } from "./router";
import { withSecurityHeaders } from "./securityHeaders";

export default {
  async fetch(request: Request, env: Env, context?: ExecutionContext): Promise<Response> {
    const requestId = resolveRequestId(request, env);

    try {
      const cacheEligible = isPublicReadCacheEligible(request, env);
      const cachedResponse = cacheEligible ? await readPublicReadCache(request, env) : null;
      const routeResponse = cachedResponse ?? (await routeRequest(request, env));

      if (!cachedResponse) {
        storePublicReadCache(request, env, routeResponse, context);
      }

      const responseWithCacheStatus = withPublicReadCacheStatus(
        routeResponse,
        cacheEligible ? (cachedResponse ? "HIT" : "MISS") : "BYPASS"
      );

      return withRequestId(withSecurityHeaders(withCors(responseWithCacheStatus, request, env)), requestId);
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
