/* global URL, Request, Response, Headers, fetch */
// Cloudflare for SaaS / Orange-to-Orange production gateway.
// This file is NOT a Worker Route in the authoritative rcat.ac.th account.
// Deploying this module to our provider account does not itself route www.
// The authoritative DNS operator alone controls the later CNAME switch.
// On workers.dev it rejects normal public requests with HTTP 503;
// only its read-only health probe can return 200. A production zone Route
// remains prohibited until owner-approved O2O and TLS tests are complete.
// No DNS, nameserver, D1, Vercel or production-route mutations are made here.

import { handleGatewayRequest } from "./gateway-worker.mjs";

const PUBLIC_HOST = "www.rcat.ac.th";
const VERIFIED_PROJECT_ALIAS = "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app";
const STANDBY_HOST = "https://rcat-web-standby.rcat-digital.workers.dev";

function blocked(reason) {
  return new Response("The gateway is not available on this hostname.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "X-RCAT-Gateway": reason,
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

function exactHttpsOrigin(raw, expected) {
  if (typeof raw !== "string") return false;
  try {
    const origin = new URL(raw);
    return (
      origin.origin === expected &&
      origin.pathname === "/" &&
      !origin.username &&
      !origin.password &&
      !origin.search &&
      !origin.hash
    );
  } catch {
    return false;
  }
}

// Only a Vercel PROJECT alias verified in the account is allowed as the
// target. Fetching www.rcat.ac.th from this Worker would recurse into O2O.
export async function handleSaasGatewayRequest(request, env, fetchOrigin = fetch) {
  const inbound = new URL(request.url);
  if (inbound.pathname === "/_rcat/saas-health" && request.method === "GET") {
    return Response.json(
      {
        service: "rcat-saas-gateway",
        configured: Boolean(
          exactHttpsOrigin(env?.RCAT_VERCEL_ORIGIN, VERIFIED_PROJECT_ALIAS) &&
          exactHttpsOrigin(env?.STANDBY_ORIGIN, STANDBY_HOST) &&
          env?.STANDBY?.fetch
        ),
        status: "not-routed"
      },
      { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
    );
  }
  if (inbound.protocol !== "https:" || inbound.hostname !== PUBLIC_HOST || env?.PUBLIC_HOSTNAME !== PUBLIC_HOST) {
    return blocked("wrong-hostname");
  }
  if (
    !exactHttpsOrigin(env?.RCAT_VERCEL_ORIGIN, VERIFIED_PROJECT_ALIAS) ||
    !exactHttpsOrigin(env?.STANDBY_ORIGIN, STANDBY_HOST) ||
    !env?.STANDBY ||
    typeof env.STANDBY.fetch !== "function"
  ) {
    return blocked("unconfigured-provider");
  }

  // The SaaS provider zone's fallback-origin DNS cannot be used for Vercel:
  // that would return to the same Gateway (a proxy loop). Use the Vercel
  // project-level alias and preserve original method/body/session for Vercel.
  const primaryFetch = async (original, options) => {
    const pathname = new URL(original.url);
    const target = VERIFIED_PROJECT_ALIAS + pathname.pathname + pathname.search;
    const out = new Request(target, original);
    out.headers.delete("Host");
    out.headers.delete("X-Forwarded-Host");
    out.headers.delete("Forwarded");
    // Explicit routing marker: Vercel production middleware accepts the
    // project alias instead of redirecting Gateway traffic back to www.
    // This does not authorize any Admin/API request; normal auth and WAF apply.
    out.headers.set("X-RCAT-Origin-Bridge", "rcat-origin-v1");
    // Vercel's WAF and CMS login validate Origin against the *upstream* Host.
    // In O2O that Host is our pinned Vercel project alias, whereas a genuine
    // browser same-origin write supplies https://www.rcat.ac.th as Origin.
    // Preserve Origin for all other origins: Vercel must continue to reject
    // cross-site writes. Never suppress Origin or weaken the auth/CSRF checks.
    const browserOrigin = out.headers.get("Origin");
    const restrictedApi =
      pathname.pathname === "/api/cms-auth" ||
      pathname.pathname.startsWith("/api/cms-auth/") ||
      pathname.pathname === "/api/admin-proxy" ||
      pathname.pathname.startsWith("/api/admin-proxy/");
    if (restrictedApi && browserOrigin === `https://${PUBLIC_HOST}`) {
      out.headers.set("Origin", VERIFIED_PROJECT_ALIAS);
    }
    // Vercel receives the original cookies/Authorization for its Admin APIs;
    // standby never does. Cloudflare sets its own upstream client-IP headers.
    const primary = await fetchOrigin(out, {
      redirect: "manual",
      signal: options?.signal
    });

    // If the Vercel project alias canonicalizes to the public hostname at the
    // identical path, the browser would repeat the same O2O request forever.
    if (primary.status >= 300 && primary.status < 400) {
      const location = primary.headers.get("Location");
      if (location) {
        let redirect;
        try {
          redirect = new URL(location, target);
        } catch {
          return blocked("malformed-origin-redirect");
        }
        if (
          redirect.hostname === PUBLIC_HOST &&
          redirect.pathname === pathname.pathname &&
          redirect.search === pathname.search
        ) {
          return new Response("Vercel origin redirects to the same Gateway URL.", {
            status: 508,
            headers: { "Cache-Control": "no-store", "X-RCAT-Gateway": "canonical-loop" }
          });
        }
      }
    }
    return primary;
  };

  // Gateway and standby are in the SAME Cloudflare account in this design.
  // Use the existing internal Service Binding rather than public workers.dev
  // fetch (which can fail due to same-zone Worker-to-Worker restrictions).
  const standbyFetch = async (sanitized) => {
    return env.STANDBY.fetch(sanitized);
  };

  return handleGatewayRequest(
    request,
    {
      ...env,
      FAILOVER_MODE: "auto",
      PUBLIC_HOSTNAME: PUBLIC_HOST,
      STANDBY_ORIGIN: STANDBY_HOST
    },
    primaryFetch,
    standbyFetch
  );
}

export default {
  fetch(request, env) {
    return handleSaasGatewayRequest(request, env);
  }
};
