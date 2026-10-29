/* global URL, Response */
import test from "node:test";
import assert from "node:assert/strict";
import { STANDBY_ORIGIN, VERCEL_ORIGIN, checkOriginReadiness, formatReadinessReport } from "./origin-readiness.mjs";

function fakeNetwork({ primaryFailure, wrongApi, redirectNews, exposePrivateStandby, networkFailure } = {}) {
  const calls = [];
  async function mockFetch(input, options) {
    const url = new URL(input);
    calls.push({ url, options });
    assert.ok([VERCEL_ORIGIN, STANDBY_ORIGIN].includes(url.origin), "No www.rcat.ac.th or arbitrary domain fetch");
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
    if (url.pathname === "/_rcat/failover-health") {
      return Response.json({ service: "rcat-web-failover", mode: "standby", status: "ok" });
    }
    if (url.origin === STANDBY_ORIGIN && ["/admin", "/api/cms-auth/session"].includes(url.pathname)) {
      return exposePrivateStandby
        ? new Response("Access granted", { status: 200 })
        : new Response("Read-only", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname.startsWith("/api/public/")) {
      return wrongApi && url.origin === VERCEL_ORIGIN
        ? new Response("<!DOCTYPE html>", { headers: { "Content-Type": "text/html" } })
        : Response.json({ generatedAt: "2026-10-29T00:00:00Z", menu: [] });
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

test("readiness covers exactly Vercel project alias and standby in GET-only mode", async () => {
  const { mockFetch, calls } = fakeNetwork();
  const result = await checkOriginReadiness(mockFetch);
  assert.equal(result.passed, true);
  assert.equal(result.checks.length, 10);
  assert.equal(calls.length, 10);
  assert.equal(calls.filter((x) => x.url.origin === VERCEL_ORIGIN).length, 4);
  assert.equal(calls.filter((x) => x.url.origin === STANDBY_ORIGIN).length, 6);
  assert.ok(calls.every((x) => !x.url.search && !x.url.hash));
  const report = formatReadinessReport(result);
  assert.match(report, /preflight: PASS/);
  assert.match(report, /NOT a live SaaS\/O2O proof/);
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

test("rejects Vercel public JSON returning an HTML login shell", async () => {
  const result = await checkOriginReadiness(fakeNetwork({ wrongApi: true }).mockFetch);
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((x) => x.name === "Vercel public home API" && !x.ok));
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
