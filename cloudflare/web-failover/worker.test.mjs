import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "./worker.mjs";

function setup(mode = "auto") {
  let assetCalls = 0;
  return {
    env: {
      FAILOVER_MODE: mode,
      ASSETS: {
        async fetch(request) {
          assetCalls += 1;
          const path = new URL(request.url).pathname;
          if (path === "/assets/missing.js") {
            return new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } });
          }
          return new Response("<!doctype html><div id='root'></div>", {
            headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" }
          });
        }
      }
    },
    calls() { return assetCalls; }
  };
}

test("healthy Vercel response stays primary without invoking backup", async () => {
  const state = setup();
  const response = await handleRequest(new Request("https://www.rcat.ac.th/news"), state.env,
    async () => new Response("SSR-OK", { status: 200 }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "SSR-OK");
  assert.equal(state.calls(), 0);
});

test("Vercel DEPLOYMENT_PAUSED 503 switches public GET to standby", async () => {
  const state = setup();
  const response = await handleRequest(new Request("https://www.rcat.ac.th/content/notice"), state.env,
    async () => new Response("DEPLOYMENT_PAUSED", { status: 503 }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-RCAT-Failover"), "primary-503");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, follow");
  assert.equal(state.calls(), 1);
});

test("transient gateway/network failure falls back for GET only", async () => {
  const state = setup();
  const response = await handleRequest(new Request("https://www.rcat.ac.th/"), state.env,
    async () => { throw new Error("timeout"); });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-RCAT-Failover"), "primary-network");
});

test("auth, API, and admin never become a fake HTML success", async () => {
  for (const path of ["/api/cms-auth/session", "/api/public/content", "/admin", "/login", "/reset-password", "/sitemap.xml"]) {
    const state = setup();
    const response = await handleRequest(new Request("https://www.rcat.ac.th" + path), state.env,
      async () => new Response("DEPLOYMENT_PAUSED", { status: 503 }));
    assert.equal(response.status, 503, path);
    assert.equal(state.calls(), 0, path);
  }
});

test("non-idempotent requests are not replayed against standby", async () => {
  const state = setup();
  let primaryRequests = 0;
  const response = await handleRequest(new Request("https://www.rcat.ac.th/api/complaint", {
    method: "POST", body: "{}"
  }), state.env, async () => {
    primaryRequests += 1;
    return new Response("unavailable", { status: 503 });
  });
  assert.equal(response.status, 503);
  assert.equal(primaryRequests, 1);
  assert.equal(state.calls(), 0);
});

test("403 and 404 do not trigger a fallback", async () => {
  for (const status of [401, 403, 404]) {
    const state = setup();
    const response = await handleRequest(new Request("https://www.rcat.ac.th/news"), state.env,
      async () => new Response("origin", { status }));
    assert.equal(response.status, status);
    assert.equal(state.calls(), 0);
  }
});

test("standby only serves public GET/HEAD", async () => {
  const state = setup("standby");
  const publicResponse = await handleRequest(new Request("https://standby.example.net/news"), state.env);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get("X-RCAT-Failover"), "standby");
  const adminResponse = await handleRequest(new Request("https://standby.example.net/admin"), state.env);
  assert.equal(adminResponse.status, 503);
  const write = await handleRequest(new Request("https://standby.example.net/api/complaint", {
    method: "POST", body: "{}"
  }), state.env);
  assert.equal(write.status, 503);
  assert.equal(state.calls(), 1);
});

test("missing hashed asset cannot be misreported as successful HTML", async () => {
  const state = setup("standby");
  const response = await handleRequest(new Request("https://standby.example.net/assets/missing.js"), state.env);
  assert.equal(response.status, 404);
});

test("health endpoint reports mode without checking Vercel", async () => {
  const state = setup("standby");
  const response = await handleRequest(new Request("https://standby.example.net/_rcat/failover-health"), state.env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { service: "rcat-web-failover", mode: "standby", status: "ok" });
  assert.equal(state.calls(), 0);
});
