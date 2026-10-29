/* global URL, Request, Response */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleGatewayRequest } from "./gateway-worker.mjs";

const LIVE_HOST = "https://www.rcat.ac.th";
const BACKUP_HOST = "https://rcat-web-standby.rcat-digital.workers.dev";
const validEnv = {
  PUBLIC_HOSTNAME: "www.rcat.ac.th",
  STANDBY_ORIGIN: BACKUP_HOST
};

function makeBackup(overrides = {}) {
  const calls = [];
  async function fetchBackup(request) {
    calls.push(request);
    const url = new URL(request.url);
    const json = url.pathname.startsWith("/api/public/");
    return new Response(json ? JSON.stringify({ items: [1] }) : "<!doctype html><div id='root'></div>", {
      status: overrides.status ?? 200,
      headers: {
        "Content-Type": overrides.contentType ?? (json ? "application/json; charset=utf-8" : "text/html"),
        "Set-Cookie": "session=must-not-leak",
        "Cache-Control": "public, max-age=9999",
        ...(overrides.headers || {})
      }
    });
  }
  return { calls, fetchBackup };
}

function primary(status, body = "primary") {
  return async () => new Response(body, { status });
}

test("normal Vercel 200 passes unchanged, standby never called", async () => {
  const backup = makeBackup();
  const response = await handleGatewayRequest(
    new Request(LIVE_HOST + "/news"),
    validEnv,
    primary(200, "SSR content"),
    backup.fetchBackup
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "SSR content");
  assert.equal(backup.calls.length, 0);
});

test("all 502/503/504 public GET errors switch to independent backup", async () => {
  for (const code of [502, 503, 504]) {
    const backup = makeBackup();
    const response = await handleGatewayRequest(
      new Request(LIVE_HOST + "/news?sort=latest"),
      validEnv,
      primary(code, "DEPLOYMENT_PAUSED"),
      backup.fetchBackup
    );
    assert.equal(response.status, 200, String(code));
    assert.equal(response.headers.get("X-RCAT-Failover"), "primary-" + code);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, follow");
    assert.equal(response.headers.get("Set-Cookie"), null);
    assert.equal(backup.calls.length, 1);
    assert.equal(backup.calls[0].url, BACKUP_HOST + "/news?sort=latest");
  }
});

test("same-origin GET /api/public reads fallback as JSON, not broken HTML", async () => {
  const backup = makeBackup();
  const response = await handleGatewayRequest(
    new Request(LIVE_HOST + "/api/public/home?lang=th"),
    validEnv,
    primary(503, "Paused"),
    backup.fetchBackup
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [1] });
  assert.equal(response.headers.get("X-RCAT-Failover"), "primary-503");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(backup.calls[0].url, BACKUP_HOST + "/api/public/home?lang=th");
  assert.equal(backup.calls[0].headers.get("Accept"), "application/json");
});

test("backup receives no browser identity, cookies or privileged headers", async () => {
  const backup = makeBackup();
  await handleGatewayRequest(
    new Request(LIVE_HOST + "/api/public/home", {
      headers: {
        Cookie: "auth=private",
        Authorization: "Bearer private",
        Origin: "https://www.rcat.ac.th",
        Referer: "https://www.rcat.ac.th/admin",
        "CF-Access-Jwt-Assertion": "private",
        "X-CSRF-Token": "private"
      }
    }),
    validEnv,
    primary(503),
    backup.fetchBackup
  );
  const sent = backup.calls[0];
  assert.deepEqual([...sent.headers.keys()], ["accept"]);
  assert.equal(sent.headers.get("Cookie"), null);
  assert.equal(sent.headers.get("Authorization"), null);
  assert.equal(sent.headers.get("Origin"), null);
});

test("network failure switches only eligible public reads", async () => {
  const backup = makeBackup();
  const fail = async () => {
    throw new Error("Vercel timeout");
  };
  const response = await handleGatewayRequest(new Request(LIVE_HOST + "/"), validEnv, fail, backup.fetchBackup);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-RCAT-Failover"), "primary-network");
  assert.equal(backup.calls.length, 1);
});

test("admin, login, CMS auth, sitemap and other APIs never fail over", async () => {
  for (const path of [
    "/admin",
    "/admin/edit",
    "/login",
    "/activate-account",
    "/reset-password",
    "/sitemap.xml",
    "/api/cms-auth/session",
    "/api/complaint",
    "/api/publication",
    "/_rcat/private"
  ]) {
    const backup = makeBackup();
    const response = await handleGatewayRequest(
      new Request(LIVE_HOST + path),
      validEnv,
      primary(503),
      backup.fetchBackup
    );
    assert.equal(response.status, 503, path);
    assert.equal(backup.calls.length, 0, path);
  }
});

test("POST and PUT never replay or switch to backup", async () => {
  for (const method of ["POST", "PUT", "DELETE"]) {
    const backup = makeBackup();
    let primaryCalls = 0;
    const response = await handleGatewayRequest(
      new Request(LIVE_HOST + "/api/public/home", { method, body: "{}" }),
      validEnv,
      async () => {
        primaryCalls++;
        return new Response("vercel-failure", { status: 503 });
      },
      backup.fetchBackup
    );
    assert.equal(response.status, 503);
    assert.equal(primaryCalls, 1);
    assert.equal(backup.calls.length, 0);
  }
});

test("origin 301/302/401/403/404 are preserved, no fallback", async () => {
  for (const code of [301, 302, 401, 403, 404]) {
    const backup = makeBackup();
    const response = await handleGatewayRequest(
      new Request(LIVE_HOST + "/news"),
      validEnv,
      primary(code),
      backup.fetchBackup
    );
    assert.equal(response.status, code);
    assert.equal(backup.calls.length, 0);
  }
});

test("standalone workers.dev preview cannot be mistaken for a production route", async () => {
  const backup = makeBackup();
  let primaryCalls = 0;
  const response = await handleGatewayRequest(
    new Request("https://rcat-web-gateway.rcat-digital.workers.dev/news"),
    validEnv,
    async () => {
      primaryCalls++;
      return new Response("bad", { status: 503 });
    },
    backup.fetchBackup
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("X-RCAT-Failover"), "gateway-not-routed");
  assert.equal(primaryCalls, 0);
  assert.equal(backup.calls.length, 0);
});

test("missing/malformed standby configuration fails closed", async () => {
  for (const origin of ["", "http://rcat-web-standby.rcat-digital.workers.dev", "https://evil.example", BACKUP_HOST + "/public"]) {
    const backup = makeBackup();
    const response = await handleGatewayRequest(
      new Request(LIVE_HOST + "/news"),
      { ...validEnv, STANDBY_ORIGIN: origin },
      primary(503),
      backup.fetchBackup
    );
    assert.equal(response.status, 503, origin);
    assert.equal(backup.calls.length, 0);
  }
});

test("standby Access-login redirect is not treated as a healthy fallback", async () => {
  const backup = makeBackup({ status: 302, headers: { Location: "https://login.cloudflareaccess.com" } });
  const response = await handleGatewayRequest(
    new Request(LIVE_HOST + "/news"),
    validEnv,
    primary(503),
    backup.fetchBackup
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Location"), null);
});

test("200 HTML masquerading as public API JSON is rejected", async () => {
  const backup = makeBackup({ contentType: "text/html" });
  const response = await handleGatewayRequest(
    new Request(LIVE_HOST + "/api/public/home"),
    validEnv,
    primary(503),
    backup.fetchBackup
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "RCAT_GATEWAY_READ_ONLY");
});

test("missing hashed JS asset must not return HTML 200", async () => {
  const backup = makeBackup();
  const response = await handleGatewayRequest(
    new Request(LIVE_HOST + "/assets/index-does-not-exist.js"),
    validEnv,
    primary(503),
    backup.fetchBackup
  );
  assert.equal(response.status, 404);
});

test("HEAD public request can fall back without streaming a body", async () => {
  const backup = makeBackup();
  const response = await handleGatewayRequest(
    new Request(LIVE_HOST + "/news", { method: "HEAD" }),
    validEnv,
    primary(503),
    backup.fetchBackup
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(backup.calls[0].method, "HEAD");
});

test("non-GET origin error returns explicit 503 without duplicating writes", async () => {
  const backup = makeBackup();
  const response = await handleGatewayRequest(
    new Request(LIVE_HOST + "/api/cms-auth/login", { method: "POST", body: "{}" }),
    validEnv,
    async () => {
      throw new Error("Network failed");
    },
    backup.fetchBackup
  );
  assert.equal(response.status, 503);
  assert.equal(backup.calls.length, 0);
});

test("non-matching private encoded paths are not eligible for backup", async () => {
  const backup = makeBackup();
  for (const path of ["/%61dmin", "/api%2fcms-auth/session", "/%6cogin"]) {
    const response = await handleGatewayRequest(
      new Request(LIVE_HOST + path),
      validEnv,
      primary(503),
      backup.fetchBackup
    );
    assert.equal(response.status, 503);
  }
  assert.equal(backup.calls.length, 0);
});

test("gateway health is available on preview without publishing any secrets", async () => {
  const response = await handleGatewayRequest(
    new Request("https://rcat-web-gateway.rcat-digital.workers.dev/_rcat/failover-health"),
    validEnv
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.service, "rcat-cross-account-gateway");
  assert.equal(data.status, "ok");
  assert.equal(JSON.stringify(data).includes("STANDBY_ORIGIN"), false);
});

test("Gateway package contains no D1/Assets/Service Binding or automatic route", () => {
  const config = readFileSync(new URL("./gateway-wrangler.toml", import.meta.url), "utf8");
  assert.match(config, /name = "rcat-web-gateway"/);
  assert.doesNotMatch(config, /(?:\[\[services\]\]|\[\[d1_databases\]\]|\[assets\]|(?:^|\n)\s*(?:routes?|custom_domain)\s*=)/i);
});
