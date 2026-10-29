/* global URL, Request, Response, Headers, fetch */
// Isolated O2O STAGING adapter: only failover-test.rcat.ac.th may reach origins.
// Deliberate fault injection applies to GET/HEAD on the TEST host only.
// Never configure this Worker on www.rcat.ac.th or a wildcard SaaS route.
import { handleGatewayRequest } from "./gateway-worker.mjs";

const TEST_HOST = "failover-test.rcat.ac.th";
const VERCEL_ORIGIN = "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app";
const STANDBY_ORIGIN = "https://rcat-web-standby.rcat-digital.workers.dev";

function blocked(reason) {
  return new Response("Staging Gateway is not available on this hostname.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-RCAT-Staging": reason
    }
  });
}

function exactOrigin(raw, expected) {
  try {
    if (typeof raw !== "string") return false;
    const url = new URL(raw);
    return (
      url.origin === expected &&
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function configured(env) {
  return Boolean(
    env?.PUBLIC_HOSTNAME === TEST_HOST &&
      env?.GATEWAY_TEST_ONLY === "true" &&
      exactOrigin(env?.RCAT_VERCEL_ORIGIN, VERCEL_ORIGIN) &&
      exactOrigin(env?.STANDBY_ORIGIN, STANDBY_ORIGIN) &&
      typeof env?.STANDBY?.fetch === "function"
  );
}

export async function handleSaasStagingRequest(request, env, fetchOrigin = fetch) {
  const url = new URL(request.url);
  // A public workers.dev probe can check binding/config without enabling proxying.
  if (url.pathname === "/_rcat/staging-health" && request.method === "GET") {
    return Response.json(
      {
        service: "rcat-saas-gateway-staging",
        configured: configured(env),
        status: url.protocol === "https:" && url.hostname === TEST_HOST ? "staging-only" : "not-routed"
      },
      { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }
    );
  }

  if (url.protocol !== "https:" || url.hostname !== TEST_HOST) {
    return blocked("wrong-hostname");
  }
  if (!configured(env)) {
    return blocked("unconfigured-staging");
  }

  const primaryFetch = async (original, options) => {
    const inbound = new URL(original.url);
    const fault = original.headers.get("X-RCAT-Staging-Simulate");
    // Synthetic faults are confined to this new test hostname and safe reads.
    // A real Vercel deployment is never paused or otherwise modified.
    if (original.method === "GET" || original.method === "HEAD") {
      if (fault === "503") return new Response(null, { status: 503 });
      if (fault === "network") throw new Error("Staging synthetic origin network failure");
    }

    const target = VERCEL_ORIGIN + inbound.pathname + inbound.search;
    const outbound = new Request(target, original);
    outbound.headers.delete("Host");
    outbound.headers.delete("Forwarded");
    outbound.headers.delete("X-Forwarded-Host");
    outbound.headers.delete("X-RCAT-Staging-Simulate");
    outbound.headers.set("X-RCAT-Origin-Bridge", "rcat-origin-v1");
    const result = await fetchOrigin(outbound, {
      redirect: "manual",
      signal: options?.signal
    });
    if (result.status >= 300 && result.status < 400) {
      const location = result.headers.get("Location");
      if (location) {
        let redirect;
        try {
          redirect = new URL(location, target);
        } catch {
          return blocked("malformed-redirect");
        }
        if (
          (redirect.hostname === TEST_HOST || redirect.hostname === "www.rcat.ac.th") &&
          redirect.pathname === inbound.pathname &&
          redirect.search === inbound.search
        ) {
          return new Response("Staging canonical loop rejected", {
            status: 508,
            headers: { "Cache-Control": "no-store", "X-RCAT-Staging": "canonical-loop" }
          });
        }
      }
    }
    return result;
  };

  const result = await handleGatewayRequest(
    request,
    {
      ...env,
      PUBLIC_HOSTNAME: TEST_HOST,
      GATEWAY_TEST_ONLY: "true",
      TEST_SIMULATE_503: "false",
      STANDBY_ORIGIN
    },
    primaryFetch,
    (sanitized) => env.STANDBY.fetch(sanitized)
  );

  const headers = new Headers(result.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Cache-Control", "no-store");
  headers.set("X-RCAT-Staging", "test-host-only");
  return new Response(request.method === "HEAD" ? null : result.body, {
    status: result.status,
    statusText: result.statusText,
    headers
  });
}

export default {
  fetch(request, env) {
    return handleSaasStagingRequest(request, env);
  }
};
