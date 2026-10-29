/* global URL, Request, Response */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleSaasStagingRequest } from "./saas-staging-worker.mjs";

const TEST = "https://failover-test.rcat.ac.th";
const VERCEL = "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app";
const BACKUP = "https://rcat-web-standby.rcat-digital.workers.dev";

function fixture() {
  const backupCalls = [];
  const env = {
    PUBLIC_HOSTNAME: "failover-test.rcat.ac.th",
    GATEWAY_TEST_ONLY: "true",
    RCAT_VERCEL_ORIGIN: VERCEL,
    STANDBY_ORIGIN: BACKUP,
    STANDBY: {
      async fetch(request) {
        backupCalls.push(request);
        if (new URL(request.url).pathname.startsWith("/api/public/")) {
          return Response.json({ ok: true }, { headers: { "Set-Cookie": "session=private" } });
        }
        return new Response("<html>Standby CSR</html>", {
          headers: { "Content-Type": "text/html", "Set-Cookie": "session=private" }
        });
      }
    }
  };
  return { env, backupCalls };
}

test("only staging hostname can proxy; workers.dev, production www and plain HTTP are fail-closed", async () => {
  const { env, backupCalls } = fixture();
  let primaryCalls = 0;
  for (const target of [
    "https://rcat-saas-gateway-staging.rcat-digital.workers.dev/news",
    "https://www.rcat.ac.th/news",
    "http://failover-test.rcat.ac.th/news",
    "https://evil.example/news"
  ]) {
    const response = await handleSaasStagingRequest(new Request(target), env, async () => {
      primaryCalls++;
      return new Response("unsafe");
    });
    assert.equal(response.status, 503, target);
    assert.equal(response.headers.get("X-RCAT-Staging"), "wrong-hostname");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.match(response.headers.get("X-Robots-Tag"), /noindex/);
  }
  assert.equal(primaryCalls, 0);
  assert.equal(backupCalls.length, 0);
});

test("workers.dev health proves configuration but cannot route normal traffic", async () => {
  const { env } = fixture();
  const response = await handleSaasStagingRequest(
    new Request("https://rcat-saas-gateway-staging.rcat-digital.workers.dev/_rcat/staging-health"),
    env
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "rcat-saas-gateway-staging",
    configured: true,
    status: "not-routed"
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("staging healthy primary preserves SSR, cookies and Vercel project alias", async () => {
  const { env, backupCalls } = fixture();
  let count = 0;
  const response = await handleSaasStagingRequest(
    new Request(TEST + "/news?page=2", { headers: { Cookie: "session=staging", "X-Forwarded-Host": "evil" } }),
    env,
    async (request, options) => {
      count++;
      assert.equal(request.url, VERCEL + "/news?page=2");
      assert.equal(request.headers.get("Cookie"), "session=staging");
      assert.equal(request.headers.get("X-Forwarded-Host"), null);
      assert.equal(request.headers.get("Host"), null);
      assert.equal(request.headers.get("X-RCAT-Origin-Bridge"), "rcat-origin-v1");
      assert.equal(options.redirect, "manual");
      return new Response("<html>SSR healthy</html>", {
        headers: { "Content-Type": "text/html", "Set-Cookie": "session=vercel" }
      });
    }
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>SSR healthy</html>");
  assert.equal(response.headers.get("Set-Cookie"), "session=vercel");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(count, 1);
  assert.equal(backupCalls.length, 0);
});

test("test-only 503 fault switches public reads to binding and strips all identity", async () => {
  const { env, backupCalls } = fixture();
  let primaryCalls = 0;
  const response = await handleSaasStagingRequest(
    new Request(TEST + "/api/public/home?lang=th", {
      headers: {
        "X-RCAT-Staging-Simulate": "503",
        Cookie: "session=private",
        Authorization: "Bearer private",
        "CF-Access-Jwt-Assertion": "private"
      }
    }),
    env,
    async () => {
      primaryCalls++;
      throw new Error("Vercel must not be called on synthetic 503");
    }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("X-RCAT-Failover"), "primary-503");
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(primaryCalls, 0);
  assert.equal(backupCalls.length, 1);
  assert.equal(backupCalls[0].url, BACKUP + "/api/public/home?lang=th");
  assert.deepEqual([...backupCalls[0].headers.keys()], ["accept"]);
});

test("test-only synthetic network outage falls back, then primary automatically recovers", async () => {
  const { env, backupCalls } = fixture();
  const outage = await handleSaasStagingRequest(
    new Request(TEST + "/news", { headers: { "X-RCAT-Staging-Simulate": "network" } }),
    env,
    async () => {
      throw new Error("Not allowed to hit live origin during synthetic outage");
    }
  );
  assert.equal(outage.status, 200);
  assert.equal(outage.headers.get("X-RCAT-Failover"), "primary-network");
  const normal = await handleSaasStagingRequest(
    new Request(TEST + "/news", { headers: { "X-RCAT-Staging-Simulate": "invalid" } }),
    env,
    async (req) => {
      assert.equal(req.headers.get("X-RCAT-Staging-Simulate"), null);
      return new Response("SSR restored");
    }
  );
  assert.equal(normal.status, 200);
  assert.equal(await normal.text(), "SSR restored");
  assert.equal(normal.headers.get("X-RCAT-Failover"), null);
  assert.equal(backupCalls.length, 1);
});

test("Admin and private APIs never fall back during staging faults", async () => {
  const { env, backupCalls } = fixture();
  for (const path of ["/admin", "/login", "/api/cms-auth/session", "/api/complaint"]) {
    const response = await handleSaasStagingRequest(
      new Request(TEST + path, { headers: { "X-RCAT-Staging-Simulate": "503" } }),
      env
    );
    assert.equal(response.status, 503, path);
    assert.equal(backupCalls.length, 0);
  }
});

test("staging POST and PUT are never replayed or used for fault injection", async () => {
  const { env, backupCalls } = fixture();
  for (const method of ["POST", "PUT"]) {
    let primaryCalls = 0;
    const response = await handleSaasStagingRequest(
      new Request(TEST + "/api/cms-auth/session", {
        method,
        body: "{}",
        headers: { "X-RCAT-Staging-Simulate": "503", "Content-Type": "application/json" }
      }),
      env,
      async (outbound) => {
        primaryCalls++;
        assert.equal(outbound.method, method);
        assert.equal(outbound.headers.get("X-RCAT-Staging-Simulate"), null);
        return new Response("origin-auth", { status: 503 });
      }
    );
    assert.equal(response.status, 503);
    assert.equal(primaryCalls, 1);
    assert.equal(backupCalls.length, 0);
  }
});

test("staging rejects canonical redirects back to www or test host on identical path", async () => {
  const { env, backupCalls } = fixture();
  for (const host of [TEST, "https://www.rcat.ac.th"]) {
    const response = await handleSaasStagingRequest(
      new Request(TEST + "/news"),
      env,
      async () => new Response(null, { status: 308, headers: { Location: host + "/news" } })
    );
    assert.equal(response.status, 508);
    assert.equal(response.headers.get("X-RCAT-Staging"), "test-host-only");
    assert.equal(backupCalls.length, 0);
  }
});

test("missing binding or wrong env blocks staging before primary and standby", async () => {
  const { env, backupCalls } = fixture();
  for (const invalid of [
    { GATEWAY_TEST_ONLY: "false" },
    { PUBLIC_HOSTNAME: "www.rcat.ac.th" },
    { RCAT_VERCEL_ORIGIN: "https://www.rcat.ac.th" },
    { STANDBY_ORIGIN: "https://evil.example" },
    { STANDBY: null }
  ]) {
    const response = await handleSaasStagingRequest(new Request(TEST + "/news"), { ...env, ...invalid }, async () => {
      throw new Error("Invalid staging env must not call Vercel");
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("X-RCAT-Staging"), "unconfigured-staging");
    assert.equal(backupCalls.length, 0);
  }
});

test("staging Wrangler config cannot mutate production DNS, route, D1 or www", () => {
  const text = readFileSync(new URL("./saas-staging-wrangler.toml", import.meta.url), "utf8");
  assert.match(text, /^name = "rcat-saas-gateway-staging"$/m);
  assert.match(text, /^PUBLIC_HOSTNAME = "failover-test.rcat.ac.th"$/m);
  assert.match(text, /^GATEWAY_TEST_ONLY = "true"$/m);
  assert.match(text, /^service = "rcat-web-standby"$/m);
  assert.doesNotMatch(text, /^(?:routes?|zone_id|zone_name|custom_domain)\s*=/m);
  assert.doesNotMatch(text, /\[\[d1_databases\]\]|\[assets\]/);
  assert.doesNotMatch(text, /^PUBLIC_HOSTNAME = "www.rcat.ac.th"$/m);
});
