// Emergency RCAT public-site standby and optional route-level failover.
// No DNS, project-domain, D1, or production Worker mutations occur on deployment.
// In gateway mode this MUST run as a Cloudflare Route over the existing Vercel origin.
// A workers.dev hostname has no underlying route origin and cannot validate gateway mode.

const FAILOVER_STATUSES = new Set([502, 503, 504]);
const PRIVATE_PATH = /^\/(?:api(?:\/|$)|admin(?:\/|$)|login\/?$|activate-account\/?$|reset-password\/?$|sitemap\.xml$|_rcat(?:\/|$))/i;
const ASSET_EXTENSION = /\.(?:js|mjs|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|eot|pdf|webmanifest)$/i;

function notAvailable(reason, wantsJson = false) {
  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": "300",
    "X-Robots-Tag": "noindex, nofollow",
    "X-RCAT-Failover": reason
  };
  return wantsJson
    ? new Response(JSON.stringify({ error: "Service temporarily unavailable", code: "RCAT_STANDBY_READ_ONLY" }), {
        status: 503,
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
      })
    : new Response("This feature is temporarily unavailable during website failover.", {
        status: 503,
        headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" }
      });
}

function standbyEligible(request) {
  const path = new URL(request.url).pathname;
  return (request.method === "GET" || request.method === "HEAD") && !PRIVATE_PATH.test(path);
}

// Public READ requests are proxied server-side through the existing Worker
// Service Binding. This avoids preview-origin CORS failures without ever
// exposing Admin credentials, making D1 writes, or mutating the Public API.
function isPublicReadPath(path) {
  return path.startsWith("/api/public/");
}

async function publicReadResponse(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowed = !origin || origin === url.origin || origin === "https://www.rcat.ac.th";
  if (!allowed) return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });

  const cors = new Headers({
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  });
  if (origin) cors.set("Access-Control-Allow-Origin", origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return notAvailable("standby-read-only", true);
  }
  if (!env.PUBLIC_API || typeof env.PUBLIC_API.fetch !== "function") return notAvailable("public-api-unconfigured", true);

  try {
    // No Origin, cookies, Authorization, or user-supplied privileged headers
    // are forwarded; PUBLIC_API receives only a public GET/HEAD and Accept.
    const backendUrl = new URL(url.pathname + url.search, "https://rcat-public-api-preview.rcat-digital.workers.dev");
    const upstream = await env.PUBLIC_API.fetch(new Request(backendUrl.toString(), {
      method: request.method,
      headers: { Accept: "application/json" }
    }));
    const headers = new Headers(upstream.headers);
    headers.delete("Set-Cookie");
    headers.delete("Access-Control-Allow-Origin");
    headers.delete("Access-Control-Allow-Credentials");
    headers.delete("Access-Control-Allow-Methods");
    headers.delete("Access-Control-Allow-Headers");
    for (const [name, value] of cors) {
      if (name.toLowerCase() !== "cache-control") headers.set(name, value);
    }
    headers.set("X-RCAT-Failover", "standby-public-api");
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  } catch {
    return notAvailable("public-api-error", true);
  }
}

async function standbyResponse(request, env, reason) {
  const path = new URL(request.url).pathname;
  if (!standbyEligible(request)) return notAvailable(reason, /^\/api(?:\/|$)/i.test(path));
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") return notAvailable("standby-unconfigured");

  try {
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    const type = headers.get("Content-Type") || "";
    if (ASSET_EXTENSION.test(path) && type.toLowerCase().includes("text/html")) {
      return new Response("Asset not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (asset.status >= 500) return notAvailable("standby-error");
    headers.set("X-RCAT-Failover", reason);
    if (type.toLowerCase().includes("text/html")) {
      headers.set("Cache-Control", "no-store");
      // This is a CSR-only emergency fallback; never index it as the SSR document.
      headers.set("X-Robots-Tag", "noindex, follow");
    }
    return new Response(request.method === "HEAD" ? null : asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers
    });
  } catch {
    return notAvailable("standby-error");
  }
}

export async function handleRequest(request, env, fetchPrimary = fetch) {
  const url = new URL(request.url);
  const mode = env.FAILOVER_MODE === "auto" ? "auto" : "standby";

  if (url.pathname === "/_rcat/failover-health") {
    if (request.method !== "GET") return notAvailable("method-not-allowed");
    return Response.json({ service: "rcat-web-failover", mode, status: "ok" }, {
      headers: { "Cache-Control": "no-store" }
    });
  }

  if (mode === "standby") {
    if (isPublicReadPath(url.pathname)) return publicReadResponse(request, env);
    return standbyResponse(request, env, "standby");
  }

  // In Cloudflare Route mode fetch(request) reaches the existing origin in DNS.
  // Avoid changing Host, auth cookies, redirects, request method, or body.
  try {
    const response = await fetchPrimary(request, { redirect: "manual" });
    if (!FAILOVER_STATUSES.has(response.status) || !standbyEligible(request)) return response;
    return standbyResponse(request, env, "primary-" + response.status);
  } catch {
    // Never retry writes or authentication/API calls through the static fallback.
    return standbyEligible(request)
      ? standbyResponse(request, env, "primary-network")
      : notAvailable("primary-network", /^\/api(?:\/|$)/i.test(url.pathname));
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
