/* global URL, Request, Response, Headers, AbortSignal, fetch */
// Route-only gateway for the authoritative Cloudflare account managing rcat.ac.th.
// HTTPS standby lives in a DIFFERENT account; no service bindings, D1 or assets.
// This script MUST NOT be assigned to www until its operator completes the runbook.

const PUBLIC_HOST = "www.rcat.ac.th";
const TEST_HOST = "failover-test.rcat.ac.th";
const EXPECTED_STANDBY = "https://rcat-web-standby.rcat-digital.workers.dev";
const RETRYABLE = new Set([502, 503, 504]);
const ASSET_EXT = /\.(?:js|mjs|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|eot|pdf|webmanifest)$/i;
const PRIMARY_TIMEOUT_MS = 10_000;

function errorResponse(reason, api = false) {
  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": "60",
    "X-Robots-Tag": "noindex, nofollow",
    "X-RCAT-Failover": reason,
    "X-Content-Type-Options": "nosniff"
  };
  if (api) {
    return Response.json(
      { error: "Public read service unavailable", code: "RCAT_GATEWAY_READ_ONLY" },
      {
        status: 503,
        headers
      }
    );
  }
  return new Response("The public website is temporarily unavailable.", {
    status: 503,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" }
  });
}

function classify(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return "unsafe";

  let path;
  try {
    path = decodeURIComponent(new URL(request.url).pathname).toLowerCase();
  } catch {
    return "private";
  }

  if (path.includes("\\") || path.includes("\0")) return "private";
  if (path.startsWith("/api/public/")) return "public-api";
  if (path.startsWith("/api/")) return "private";
  if (path === "/api") return "private";
  if (/^\/(?:admin(?:\/|$)|login\/?$|activate-account\/?$|reset-password\/?$|sitemap\.xml$|_rcat(?:\/|$))/.test(path)) {
    return "private";
  }
  return "public-page";
}

function validateStandby(env) {
  try {
    const url = new URL(env.STANDBY_ORIGIN);
    if (
      url.origin !== EXPECTED_STANDBY ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function fallbackUrl(request) {
  const path = new URL(request.url);
  return EXPECTED_STANDBY + path.pathname + path.search;
}

async function backupFetch(request, env, type, reason, fetchBackup) {
  if (!validateStandby(env)) return errorResponse("standby-misconfigured", type === "public-api");

  // Forward ONLY public path/search and Accept. Never forward Vercel session,
  // Authorization, CF identity, CSRF, Origin or the original Host header.
  const headers = new Headers();
  headers.set("Accept", type === "public-api" ? "application/json" : request.headers.get("Accept") || "*/*");
  const req = new Request(fallbackUrl(request), {
    method: request.method,
    headers,
    redirect: "manual"
  });

  let response;
  try {
    response = await fetchBackup(req, { redirect: "manual" });
  } catch {
    return errorResponse("standby-network", type === "public-api");
  }

  // Access login redirects, error pages and Vercel-style HTML masquerading as
  // public JSON must never be presented as a healthy standby.
  if (response.status >= 300 && response.status < 400) {
    return errorResponse("standby-redirect", type === "public-api");
  }
  if (response.status >= 500 || response.status === 401 || response.status === 403) {
    return errorResponse("standby-unavailable", type === "public-api");
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (type === "public-api" && response.status === 200 && !/application\/json/i.test(contentType)) {
    return errorResponse("standby-invalid-json", true);
  }

  const path = new URL(request.url).pathname;
  if (ASSET_EXT.test(path) && /text\/html/i.test(contentType)) {
    return new Response("Standby asset not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-RCAT-Failover": "standby-asset-not-found" }
    });
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("Set-Cookie");
  responseHeaders.delete("Location");
  responseHeaders.set("X-RCAT-Failover", reason);
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("X-Frame-Options", "DENY");
  responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");

  if (type === "public-api" || /text\/html/i.test(contentType)) {
    responseHeaders.set("Cache-Control", "no-store");
  }
  if (/text\/html/i.test(contentType)) {
    // Standby is CSR-only, so do not let the fallback bootstrap replace SSR SEO.
    responseHeaders.set("X-Robots-Tag", "noindex, follow");
  }

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

export async function handleGatewayRequest(request, env, fetchPrimary = fetch, fetchBackup = fetch) {
  const url = new URL(request.url);

  if (url.pathname === "/_rcat/failover-health") {
    if (request.method !== "GET") return errorResponse("method-not-allowed");
    return Response.json(
      { service: "rcat-cross-account-gateway", mode: "unrouted-until-authorized", status: "ok" },
      {
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
      }
    );
  }

  // workers.dev preview must NOT fetch itself as the primary origin.
  // A test hostname is explicitly opt-in and cannot be enabled on www.
  const production = url.hostname === PUBLIC_HOST && env.PUBLIC_HOSTNAME === PUBLIC_HOST;
  const testHost = url.hostname === TEST_HOST && env.PUBLIC_HOSTNAME === TEST_HOST && env.GATEWAY_TEST_ONLY === "true";
  if (url.protocol !== "https:" || (!production && !testHost)) {
    return errorResponse("gateway-not-routed");
  }

  const type = classify(request);
  if (testHost && env.TEST_SIMULATE_503 === "true") {
    return type === "public-page" || type === "public-api"
      ? backupFetch(request, env, type, "primary-simulated-503", fetchBackup)
      : errorResponse("primary-simulated-503", type === "private");
  }

  let primary;
  try {
    // Do not set an arbitrary timeout on CMS writes. The 10s GET/HEAD deadline
    // only accelerates public failover when Vercel stops responding.
    primary = await fetchPrimary(
      request,
      type === "unsafe"
        ? { redirect: "manual" }
        : { redirect: "manual", signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS) }
    );
  } catch {
    return type === "public-page" || type === "public-api"
      ? backupFetch(request, env, type, "primary-network", fetchBackup)
      : errorResponse("primary-network", type === "private");
  }

  if (!RETRYABLE.has(primary.status) || (type !== "public-page" && type !== "public-api")) {
    return primary;
  }

  return backupFetch(request, env, type, "primary-" + primary.status, fetchBackup);
}

export default {
  fetch(request, env) {
    return handleGatewayRequest(request, env);
  }
};
