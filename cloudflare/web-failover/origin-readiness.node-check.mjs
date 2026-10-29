/* global URL, Response */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SAAS_CANDIDATE_ORIGIN,
  STANDBY_ORIGIN,
  VERCEL_ORIGIN,
  checkOriginReadiness,
  formatReadinessReport
} from "./origin-readiness.mjs";
import { assertPublicApiContract } from "./public-api-contract.mjs";

function homeFixture() {
  return {
    generatedAt: "2026-10-29T00:00:00Z",
    visitorStats: {},
    carouselSlides: [],
    externalServices: [],
    latestNews: [],
    latestAnnouncements: [],
    procurementItems: [],
    jobOpportunityItems: [],
    achievementItems: [],
    programItems: [],
    documentItems: [],
    eventItems: [],
    media: []
  };
}

function shellFixture() {
  return {
    generatedAt: "2026-10-29T00:00:00Z",
    menu: [],
    siteSettings: {},
    homepageSettings: {},
    displaySettings: {}
  };
}

function fakeNetwork({
  primaryFailure,
  wrongApi,
  redirectNews,
  exposePrivateStandby,
  networkFailure,
  candidateAccessRedirect,
  candidateUnconfigured,
  candidatePublicLeak,
  candidateBadGuard
} = {}) {
  const calls = [];
  async function mockFetch(input, options) {
    const url = new URL(input);
    calls.push({ url, options });
    assert.ok(
      [VERCEL_ORIGIN, STANDBY_ORIGIN, SAAS_CANDIDATE_ORIGIN].includes(url.origin),
      "No www.rcat.ac.th or arbitrary domain fetch"
    );
    assert.equal(options.method, "GET", "No mutating request");
    assert.equal(options.redirect, "manual", "No hidden redirects");
    // Explicit origin bridge bypasses the production 308 only on Vercel;
    // never send that marker to the public Cloudflare standby.
    assert.equal(
      options.headers["X-RCAT-Origin-Bridge"] ?? null,
      url.origin === VERCEL_ORIGIN ? "rcat-origin-v1" : null
    );
    assert.equal(
      options.headers.Accept,
      url.pathname.startsWith("/api/public/") || url.pathname.startsWith("/_rcat/") ? "application/json" : "text/html"
    );

    if (networkFailure && url.pathname === "/news" && url.origin === VERCEL_ORIGIN) {
      throw new Error("Origin connect timeout");
    }
    if (primaryFailure && url.origin === VERCEL_ORIGIN && url.pathname === "/") {
      return new Response("DEPLOYMENT_PAUSED", { status: 503 });
    }
    if (redirectNews && url.origin === VERCEL_ORIGIN && url.pathname === "/news") {
      return new Response(null, { status: 308, headers: { Location: "https://www.rcat.ac.th/news" } });
    }
    if (url.origin === SAAS_CANDIDATE_ORIGIN) {
      if (candidateAccessRedirect) {
        return new Response(null, { status: 302, headers: { Location: "https://access.example/login" } });
      }
      if (url.pathname === "/_rcat/saas-health") {
        return Response.json(
          {
            service: "rcat-saas-gateway-candidate",
            configured: !candidateUnconfigured,
            status: "not-routed"
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      if (candidatePublicLeak) {
        return new Response("Leaked public site content", { status: 200 });
      }
      return new Response("The gateway is not available on this hostname.", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-RCAT-Gateway": candidateBadGuard ? "unexpected" : "wrong-hostname",
          "X-Robots-Tag": "noindex, nofollow"
        }
      });
    }
    if (url.pathname === "/_rcat/failover-health") {
      return Response.json({ service: "rcat-web-failover", mode: "standby", status: "ok" });
    }
    if (url.origin === STANDBY_ORIGIN && ["/admin", "/api/cms-auth/session"].includes(url.pathname)) {
      return exposePrivateStandby
        ? new Response("Access granted", { status: 200 })
        : new Response("Read-only", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname.startsWith("/api/public/")) {
      if (wrongApi && url.origin === STANDBY_ORIGIN) {
        return new Response("<!DOCTYPE html>", { headers: { "Content-Type": "text/html" } });
      }
      if (url.pathname === "/api/public/home") {
        return Response.json(homeFixture());
      }
      if (url.pathname === "/api/public/shell") {
        return Response.json(shellFixture());
      }
      throw new Error("Unexpected public path");
    }
    if (url.origin === STANDBY_ORIGIN) {
      return new Response('<!doctype html><meta name="robots" content="noindex"><div id="root"></div>', {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    return new Response('<!doctype html><html data-rcat-ssr="true"><title>RCAT</title></html>', {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
  return { mockFetch, calls };
}

test("readiness checks Vercel, Standby and unrouted SaaS candidate in GET-only mode", async () => {
  const { mockFetch, calls } = fakeNetwork();
  const result = await checkOriginReadiness(mockFetch);
  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 11);
  assert.equal(calls.length, 11);
  assert.equal(calls.filter((x) => x.url.origin === VERCEL_ORIGIN).length, 2);
  assert.equal(calls.filter((x) => x.url.origin === STANDBY_ORIGIN).length, 6);
  assert.equal(calls.filter((x) => x.url.origin === SAAS_CANDIDATE_ORIGIN).length, 3);
  assert.ok(calls.every((x) => !x.url.search && !x.url.hash));
  // Vercel SSR calls Cloudflare Public API internally; the Vercel deployment
  // intentionally has no same-origin /api/public/* route.
  assert.ok(calls.every((x) => x.url.origin !== VERCEL_ORIGIN || !x.url.pathname.startsWith("/api/public/")));
  const report = formatReadinessReport(result);
  assert.match(report, /preflight: PASS/);
  assert.match(report, /NOT a live SaaS\/O2O proof/);
  assert.match(report, /SaaS candidate blocks public API/);
  assert.doesNotMatch(report, /Authorization|Set-Cookie|private-token/);
});

test("detects Vercel-paused origin without triggering any fallback traffic writes", async () => {
  const { mockFetch, calls } = fakeNetwork({ primaryFailure: true });
  const result = await checkOriginReadiness(mockFetch);
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((x) => x.name === "Vercel SSR home" && x.reason === "HTTP 503"));
  assert.ok(calls.every((x) => x.options.method === "GET"));
});

test("detects canonical redirect from Vercel alias to the public hostname before it can loop", async () => {
  const result = await checkOriginReadiness(fakeNetwork({ redirectNews: true }).mockFetch);
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((x) => x.name === "Vercel SSR news" && x.reason.includes("redirect")));
});

test("rejects Cloudflare Standby public JSON returning an HTML login shell", async () => {
  const result = await checkOriginReadiness(fakeNetwork({ wrongApi: true }).mockFetch);
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((x) => x.name === "Standby public home API" && !x.ok));
});

test("rejects standby accidentally exposing private/Admin routes", async () => {
  const result = await checkOriginReadiness(fakeNetwork({ exposePrivateStandby: true }).mockFetch);
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((x) => x.name === "Standby blocks Admin" && !x.ok));
  assert.ok(result.checks.some((x) => x.name === "Standby blocks private API" && !x.ok));
});

test("network failures are recorded as BLOCKED without leaking exception strings", async () => {
  const result = await checkOriginReadiness(fakeNetwork({ networkFailure: true }).mockFetch);
  assert.equal(result.passed, false);
  const check = result.checks.find((x) => x.name === "Vercel SSR news");
  assert.equal(check.reason, "network or timeout");
  assert.doesNotMatch(formatReadinessReport(result), /Origin connect timeout/);
});

test("body validation rejects stale plain-text or 2xx partial content", async () => {
  const network = fakeNetwork();
  const result = await checkOriginReadiness(async (url, options) => {
    if (url === VERCEL_ORIGIN + "/") return new Response("healthy?", { status: 200 });
    return network.mockFetch(url, options);
  });
  assert.equal(result.passed, false);
  assert.equal(
    result.checks.find((x) => x.name === "Vercel SSR home").reason,
    "invalid origin response or content-type"
  );
});

test("public-home contract deliberately has no menu; public-shell requires a menu", () => {
  assert.doesNotThrow(() => assertPublicApiContract("/api/public/home", homeFixture()));
  assert.doesNotThrow(() => assertPublicApiContract("/api/public/shell", shellFixture()));
  assert.throws(() => assertPublicApiContract("/api/public/shell", homeFixture()), /missing menu/);
  assert.throws(() => assertPublicApiContract("/api/public/home", shellFixture()), /missing visitorStats/);
});

test("read-only preflight rejects a malformed home snapshot even when HTTP 200 JSON is returned", async () => {
  const network = fakeNetwork();
  const result = await checkOriginReadiness(async (url, options) => {
    if (url === STANDBY_ORIGIN + "/api/public/home") {
      return Response.json({ generatedAt: "2026-10-29T00:00:00Z", menu: [] });
    }
    return network.mockFetch(url, options);
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => item.name === "Standby public home API" && !item.ok));
});

test("blocks if SaaS Candidate is intercepted by Cloudflare Access", async () => {
  const result = await checkOriginReadiness(fakeNetwork({ candidateAccessRedirect: true }).mockFetch);
  assert.equal(result.passed, false);
  assert.equal(result.checks.filter((x) => x.name.startsWith("SaaS candidate") && !x.ok).length, 3);
  assert.ok(result.checks.some((x) => x.reason.includes("unexpected redirect")));
});

test("blocks if SaaS Candidate is misconfigured or accidentally serves public traffic", async () => {
  for (const scenario of [
    { candidateUnconfigured: true },
    { candidatePublicLeak: true },
    { candidateBadGuard: true }
  ]) {
    const result = await checkOriginReadiness(fakeNetwork(scenario).mockFetch);
    assert.equal(result.passed, false);
    assert.ok(result.checks.some((x) => x.name.startsWith("SaaS candidate") && !x.ok));
  }
});

test("rejects an origin readiness report leaking a public production probe or credentials", async () => {
  const { mockFetch, calls } = fakeNetwork();
  const result = await checkOriginReadiness(mockFetch);
  assert.equal(result.passed, true);
  assert.ok(calls.every((call) => call.url.hostname !== "www.rcat.ac.th"));
  assert.ok(calls.every((call) => !["POST", "PUT", "PATCH", "DELETE"].includes(call.options.method)));
  assert.ok(calls.every((call) => !Object.keys(call.options.headers).some((h) => /cookie|authorization/i.test(h))));
});
