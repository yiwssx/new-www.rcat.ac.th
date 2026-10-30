/* global URL, Request, Response */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleSaasGatewayRequest } from "./saas-gateway-worker.mjs";

const PUB = "https://www.rcat.ac.th";
const VERCEL = "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app";
const BACKUP = "https://rcat-web-standby.rcat-digital.workers.dev";

function fixture() {
  const backupRequests = [];
  const env = {
    PUBLIC_HOSTNAME: "www.rcat.ac.th",
    RCAT_VERCEL_ORIGIN: VERCEL,
    STANDBY_ORIGIN: BACKUP,
    STANDBY: {
      async fetch(request) {
        backupRequests.push(request);
        const isApi = new URL(request.url).pathname.startsWith("/api/public/");
        return isApi
          ? Response.json({ title: "RCAT public site" }, { headers: { "Set-Cookie": "PRIVATE=1" } })
          : new Response("<!doctype html><div id='root'></div>", {
              headers: { "Content-Type": "text/html", "Set-Cookie": "PRIVATE=1" }
            });
      }
    }
  };
  return { env, backupRequests };
}

test("healthy SSR is fetched through Vercel project alias without DNS recursion", async () => {
  const { env, backupRequests } = fixture();
  const incoming = new Request(PUB + "/news?page=3", { headers: { Cookie: "session=x" } });
  let calls = 0;
  const response = await handleSaasGatewayRequest(incoming, env, async (request, init) => {
    calls++;
    assert.equal(request.url, VERCEL + "/news?page=3");
    assert.equal(request.headers.get("cookie"), "session=x");
    assert.equal(request.headers.get("Host"), null);
    assert.equal(request.headers.get("X-RCAT-Origin-Bridge"), "rcat-origin-v1");
    assert.equal(init.redirect, "manual");
    return new Response("<html>SSR OK</html>", { status: 200, headers: { "Content-Type": "text/html" } });
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>SSR OK</html>");
  assert.equal(calls, 1);
  assert.equal(backupRequests.length, 0);
});

test("502/503/504 on public GET switch through same-account standby binding", async () => {
  for (const status of [502, 503, 504]) {
    const { env, backupRequests } = fixture();
    const response = await handleSaasGatewayRequest(
      new Request(PUB + "/announcements"),
      env,
      async () => new Response("DEPLOYMENT_PAUSED", { status })
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-RCAT-Failover"), "primary-" + status);
    assert.equal(response.headers.get("Set-Cookie"), null);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, follow");
    assert.equal(backupRequests.length, 1);
    assert.equal(backupRequests[0].url, BACKUP + "/announcements");
  }
});

test("public API fallback gives sanitized JSON without browser secrets", async () => {
  const { env, backupRequests } = fixture();
  const response = await handleSaasGatewayRequest(
    new Request(PUB + "/api/public/home?lang=th", {
      headers: {
        Cookie: "secret=1",
        Authorization: "Bearer secret",
        Origin: PUB,
        Referer: PUB + "/admin",
        "CF-Access-Jwt-Assertion": "private-token"
      }
    }),
    env,
    async () => new Response("DEPLOYMENT_PAUSED", { status: 503 })
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { title: "RCAT public site" });
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(response.headers.get("X-RCAT-Failover"), "primary-503");
  assert.equal(backupRequests[0].url, BACKUP + "/api/public/home?lang=th");
  assert.deepEqual([...backupRequests[0].headers.keys()], ["accept"]);
});

test("private sessions and unsafe HTTP methods reach only Vercel, never standby", async () => {
  const { env, backupRequests } = fixture();
  let postSeen = 0;
  for (const path of ["/admin", "/login", "/api/cms-auth/session", "/api/complaint"]) {
    const response = await handleSaasGatewayRequest(
      new Request(PUB + path),
      env,
      async () => new Response("Vercel paused", { status: 503 })
    );
    assert.equal(response.status, 503, path);
  }
  const response = await handleSaasGatewayRequest(
    new Request(PUB + "/api/cms-auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
      headers: { Cookie: "session=abc", "Content-Type": "application/json" }
    }),
    env,
    async (request) => {
      postSeen++;
      assert.equal(request.method, "POST");
      assert.equal(request.url, VERCEL + "/api/cms-auth/login");
      assert.equal(request.headers.get("Cookie"), "session=abc");
      assert.equal(await request.text(), JSON.stringify({ email: "user@example.com" }));
      return new Response("Vercel paused", { status: 503 });
    }
  );
  assert.equal(response.status, 503);
  assert.equal(postSeen, 1);
  assert.equal(backupRequests.length, 0);
});

test("primary healthy 302, 403 and 404 are passed unchanged", async () => {
  for (const status of [302, 403, 404]) {
    const { env, backupRequests } = fixture();
    const response = await handleSaasGatewayRequest(
      new Request(PUB + "/news"),
      env,
      async () =>
        new Response("Vercel status", {
          status,
          headers: status === 302 ? { Location: "/another-page" } : {}
        })
    );
    assert.equal(response.status, status);
    assert.equal(backupRequests.length, 0);
  }
});

test("canonical Vercel redirect back to identical public URL is blocked (no infinite loop)", async () => {
  const { env, backupRequests } = fixture();
  const response = await handleSaasGatewayRequest(
    new Request(PUB + "/news?sort=latest"),
    env,
    async () =>
      new Response(null, {
        status: 308,
        headers: { Location: PUB + "/news?sort=latest" }
      })
  );
  assert.equal(response.status, 508);
  assert.equal(response.headers.get("X-RCAT-Gateway"), "canonical-loop");
  assert.equal(backupRequests.length, 0);
});

test("Vercel origin network outage falls back for public page only and recovers", async () => {
  const { env, backupRequests } = fixture();
  const request = new Request(PUB + "/news");
  const down = await handleSaasGatewayRequest(request, env, async () => {
    throw new Error("origin connect failed");
  });
  assert.equal(down.status, 200);
  assert.equal(down.headers.get("X-RCAT-Failover"), "primary-network");
  const restored = await handleSaasGatewayRequest(request, env, async () => new Response("SSR-restored"));
  assert.equal(await restored.text(), "SSR-restored");
  assert.equal(restored.headers.get("X-RCAT-Failover"), null);
  assert.equal(backupRequests.length, 1);
});

test("isolated workers.dev candidate fails closed on public GET/HEAD, API and writes", async () => {
  const { env, backupRequests } = fixture();
  let originCalls = 0;
  const preview = "https://rcat-saas-gateway.rcat-digital.workers.dev";
  const attempts = [
    new Request(preview + "/news"),
    new Request(preview + "/api/public/home?lang=th"),
    new Request(preview + "/news", { method: "HEAD" }),
    new Request(preview + "/api/public/home", { method: "POST", body: "not-allowed" }),
    new Request("https://unrelated.example/news")
  ];
  for (const request of attempts) {
    const response = await handleSaasGatewayRequest(request, env, async () => {
      originCalls++;
      return new Response("unexpected origin access");
    });
    assert.equal(response.status, 503, request.url + " " + request.method);
    assert.equal(response.headers.get("X-RCAT-Gateway"), "wrong-hostname");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Set-Cookie"), null);
  }
  assert.equal(originCalls, 0);
  assert.equal(backupRequests.length, 0);
});

test("fails closed for invalid aliases, missing standby binding or credentials in origin URL", async () => {
  const { env } = fixture();
  for (const changes of [
    { RCAT_VERCEL_ORIGIN: PUB },
    { RCAT_VERCEL_ORIGIN: "https://evil.example" },
    { RCAT_VERCEL_ORIGIN: VERCEL + "/path" },
    { RCAT_VERCEL_ORIGIN: "https://x:y@new-wwwrcatacth-rcat-it-dev-team.vercel.app" },
    { STANDBY_ORIGIN: "http://rcat-web-standby.rcat-digital.workers.dev" },
    { STANDBY: undefined }
  ]) {
    const response = await handleSaasGatewayRequest(new Request(PUB + "/"), { ...env, ...changes }, async () => {
      throw new Error("Must not request Vercel with invalid config");
    });
    assert.equal(response.status, 503, JSON.stringify(Object.keys(changes)));
    assert.equal(response.headers.get("X-RCAT-Gateway"), "unconfigured-provider");
  }
});

test("health endpoint is safe on workers.dev and is not a live O2O proof", async () => {
  const { env } = fixture();
  const response = await handleSaasGatewayRequest(
    new Request("https://rcat-saas-gateway.rcat-digital.workers.dev/_rcat/saas-health"),
    env
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "rcat-saas-gateway",
    configured: true,
    status: "not-routed"
  });
});

test("SaaS Wrangler candidate does not create DNS, routes, certs or a new zone", () => {
  const text = readFileSync(new URL("./saas-gateway-wrangler.toml", import.meta.url), "utf8");
  assert.match(text, /name = "rcat-saas-gateway"/);
  assert.match(text, /service = "rcat-web-standby"/);
  assert.doesNotMatch(text, /^(?:routes?|zone_id|zone_name|custom_domain)\s*=/m);
  assert.doesNotMatch(text, /\[\[d1_databases\]\]|\[assets\]/);
});

test("trusted WWW browser login POST gets Vercel-alias Origin without losing body or cookies", async () => {
  const { env, backupRequests } = fixture();
  const body = JSON.stringify({ identifier: "example@example.invalid", password: "not-a-secret" });
  let upstreamCalls = 0;
  const response = await handleSaasGatewayRequest(
    new Request(PUB + "/api/cms-auth/login", {
      method: "POST",
      headers: {
        Origin: PUB,
        "Sec-Fetch-Site": "same-origin",
        Cookie: "__Host-rcat_cms_csrf=test",
        "Content-Type": "application/json"
      },
      body
    }),
    env,
    async (request) => {
      upstreamCalls++;
      assert.equal(request.url, VERCEL + "/api/cms-auth/login");
      assert.equal(request.headers.get("Origin"), VERCEL);
      assert.equal(request.headers.get("Sec-Fetch-Site"), "same-origin");
      assert.equal(request.headers.get("Cookie"), "__Host-rcat_cms_csrf=test");
      assert.equal(request.headers.get("Host"), null);
      assert.equal(request.headers.get("X-Forwarded-Host"), null);
      assert.equal(request.method, "POST");
      assert.equal(await request.text(), body);
      return Response.json({ ok: true });
    }
  );
  assert.equal(response.status, 200);
  assert.equal(upstreamCalls, 1);
  assert.equal(backupRequests.length, 0);
});

test("trusted WWW admin-proxy requests get the same restricted upstream Origin handling", async () => {
  const { env, backupRequests } = fixture();
  const response = await handleSaasGatewayRequest(
    new Request(PUB + "/api/admin-proxy?path=%2Fapi%2Fadmin%2Fsettings", {
      method: "POST",
      headers: { Origin: PUB, "Content-Type": "application/json" },
      body: JSON.stringify({ test: true })
    }),
    env,
    async (request) => {
      assert.equal(request.headers.get("Origin"), VERCEL);
      assert.equal(request.url, VERCEL + "/api/admin-proxy?path=%2Fapi%2Fadmin%2Fsettings");
      return new Response(null, { status: 204 });
    }
  );
  assert.equal(response.status, 204);
  assert.equal(backupRequests.length, 0);
});

test("foreign, null, and cross-site browser Origins are never promoted to trusted Origin", async () => {
  for (const origin of ["https://attacker.example", "null", "http://www.rcat.ac.th"]) {
    const { env, backupRequests } = fixture();
    const result = await handleSaasGatewayRequest(
      new Request(PUB + "/api/cms-auth/login", {
        method: "POST",
        headers: { Origin: origin, "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "example@example.invalid" })
      }),
      env,
      async (request) => {
        assert.equal(request.headers.get("Origin"), origin);
        assert.equal(request.headers.get("Sec-Fetch-Site"), "cross-site");
        return Response.json({ error: "request denied by edge security policy" }, { status: 403 });
      }
    );
    assert.equal(result.status, 403, origin);
    assert.equal(backupRequests.length, 0);
  }
});

test("public pages and anonymous reads do not rewrite Origin or disable failover", async () => {
  const { env } = fixture();
  const result = await handleSaasGatewayRequest(
    new Request(PUB + "/news", { headers: { Origin: PUB } }),
    env,
    async (request) => {
      assert.equal(request.headers.get("Origin"), PUB);
      return new Response("SSR OK", { status: 200 });
    }
  );
  assert.equal(result.status, 200);
});

test("browser-declared cross-site login stays blocked even with a forged trusted Origin", async () => {
  const { env, backupRequests } = fixture();
  const response = await handleSaasGatewayRequest(
    new Request(PUB + "/api/cms-auth/login", {
      method: "POST",
      headers: { Origin: PUB, "Sec-Fetch-Site": "cross-site" },
      body: "{}"
    }),
    env,
    async (request) => {
      assert.equal(request.headers.get("Origin"), PUB);
      assert.equal(request.headers.get("Sec-Fetch-Site"), "cross-site");
      return Response.json({ error: "cross-site denied" }, { status: 403 });
    }
  );
  assert.equal(response.status, 403);
  assert.equal(backupRequests.length, 0);
});
