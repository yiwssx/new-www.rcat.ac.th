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

test("standby serves public API reads through sanitized service binding", async () => {
  const state = setup("standby");
  let backendCalled = 0;
  state.env.PUBLIC_API = {
    async fetch(request) {
      backendCalled++;
      assert.equal(request.method, "GET");
      assert.equal(request.headers.get("Cookie"), null);
      assert.equal(request.headers.get("Authorization"), null);
      assert.equal(request.headers.get("Origin"), null);
      assert.equal(new URL(request.url).pathname, "/api/public/home");
      return Response.json({ generatedAt: "2026-10-29T00:00:00Z" });
    }
  };
  const response = await handleRequest(new Request(
    "https://rcat-web-standby.rcat-digital.workers.dev/api/public/home",
    { headers: { Origin: "https://www.rcat.ac.th", Authorization: "Bearer dangerous", Cookie: "secret=123" } }
  ), state.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://www.rcat.ac.th");
  assert.equal(response.headers.get("X-RCAT-Failover"), "standby-public-api");
  assert.equal((await response.json()).generatedAt, "2026-10-29T00:00:00Z");
  assert.equal(backendCalled, 1);
  assert.equal(state.calls(), 0);
});

test("standby API does not expose Admin proxy or accept public writes", async () => {
  const state = setup("standby");
  let backendCalls = 0;
  state.env.PUBLIC_API = { async fetch() { backendCalls++; return Response.json({}); } };
  for (const path of ["/api/admin/users", "/api/cms-auth/session", "/api/complaint"]) {
    const response = await handleRequest(new Request("https://standby.example.net" + path), state.env);
    assert.equal(response.status, 503);
  }
  const write = await handleRequest(new Request("https://standby.example.net/api/public/site-view", {
    method: "POST", body: "{}"
  }), state.env);
  assert.equal(write.status, 503);
  const wrongOrigin = await handleRequest(new Request("https://standby.example.net/api/public/home", {
    headers: { Origin: "https://example.org" }
  }), state.env);
  assert.equal(wrongOrigin.status, 403);
  assert.equal(backendCalls, 0);
});

test("public API read preflight is bounded to the approved browser origin", async () => {
  const state = setup("standby");
  const response = await handleRequest(new Request("https://standby.example.net/api/public/home", {
    method: "OPTIONS", headers: { Origin: "https://www.rcat.ac.th" }
  }), state.env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://www.rcat.ac.th");
});
