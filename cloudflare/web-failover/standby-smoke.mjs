/* global URL, fetch, AbortSignal, document */
// Live, read-only public standby smoke. Never sends mutations to the API or D1.
// Intended for the isolated *.workers.dev standby, not www production.

import assert from "node:assert/strict";
import { assertPublicApiContract } from "./public-api-contract.mjs";

const base = process.env.STANDBY_BASE_URL?.trim() ?? "";
const browserEnabled = process.env.RUN_BROWSER_SMOKE === "true";
const root = new URL(base);

if (
  root.protocol !== "https:" ||
  !/^rcat-web-standby\.[a-z0-9-]+\.workers\.dev$/.test(root.hostname) ||
  root.pathname !== "/" ||
  root.search ||
  root.hash ||
  root.username ||
  root.password
) {
  throw new Error("STANDBY_BASE_URL must identify the isolated rcat-web-standby Workers.dev origin");
}

async function request(path, options = {}) {
  const url = new URL(path, root);
  if (url.origin !== root.origin) throw new Error("Refusing cross-origin smoke request");

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: "*/*", ...options.headers }
      });
      // Retry only transient upstream errors, not functional regressions.
      if (response.status < 500 || attempt === 3) return response;
      lastError = new Error(path + " returned HTTP " + response.status);
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
    }
  }
  throw lastError ?? new Error("No response from standby");
}

function status(response, expected, path) {
  assert.equal(response.status, expected, path + " returned HTTP " + response.status);
}

const health = await request("/_rcat/failover-health");
status(health, 200, "Worker health");
const healthPayload = await health.json();
assert.deepEqual(
  { status: healthPayload.status, mode: healthPayload.mode, service: healthPayload.service },
  { status: "ok", mode: "standby", service: "rcat-web-failover" }
);
console.log("PASS health and standby mode");

const htmlResponse = await request("/news");
status(htmlResponse, 200, "News CSR document");
assert.match(htmlResponse.headers.get("content-type") ?? "", /text\/html/i);
assert.match(htmlResponse.headers.get("x-robots-tag") ?? "", /noindex/);
const html = await htmlResponse.text();
assert.match(html, /id=["']root["']/);
assert.match(html, /noindex/i);
console.log("PASS CSR HTML, noindex and root");

const scriptPath = html.match(/<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["']/i)?.[1];
assert.ok(scriptPath, "CSR entry must reference a content-hashed JS asset");
const scriptResponse = await request(scriptPath);
status(scriptResponse, 200, "Hashed JS asset");
assert.doesNotMatch(scriptResponse.headers.get("content-type") ?? "", /text\/html/i);
assert.match(scriptResponse.headers.get("content-type") ?? "", /javascript/i);
console.log("PASS hashed JavaScript asset");

for (const path of ["/api/public/home", "/api/public/shell"]) {
  const response = await request(path, {
    headers: { Origin: root.origin, Accept: "application/json" }
  });
  status(response, 200, path);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/i);
  assert.equal(response.headers.get("access-control-allow-origin"), root.origin);
  assert.equal(response.headers.get("x-rcat-failover"), "standby-public-api");
  const payload = await response.json();
  assert.equal(typeof payload.generatedAt, "string", path + " missing generatedAt");
  assertPublicApiContract(path, payload);
  console.log("PASS " + path + " (public data + CORS)");
}

for (const path of ["/admin", "/api/cms-auth/session", "/sitemap.xml"]) {
  const response = await request(path);
  status(response, 503, path + " must be unavailable in read-only mode");
  console.log("PASS protected " + path + " blocked");
}

const preflight = await request("/api/public/home", {
  method: "OPTIONS",
  headers: { Origin: root.origin, "Access-Control-Request-Method": "GET" }
});
status(preflight, 204, "Public API preflight");
assert.equal(preflight.headers.get("access-control-allow-origin"), root.origin);
console.log("PASS public API preflight");

if (browserEnabled) {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const path of ["/", "/news"]) {
      const page = await browser.newPage({ viewport: { width: 1365, height: 850 } });
      const uncaught = [];
      page.on("pageerror", (error) => uncaught.push(error.message));
      const nav = await page.goto(new URL(path, root).href, {
        waitUntil: "domcontentloaded",
        timeout: 25_000
      });
      assert.equal(nav?.status(), 200, "Browser navigation " + path);
      await page.waitForFunction(() => (document.querySelector("#root")?.textContent?.trim().length ?? 0) > 120, null, {
        timeout: 25_000
      });
      const body = (await page.locator("#root").innerText()).trim();
      assert.match(body, /วิทยาลัย|เกษตร|RCAT|ข่าว/i, "Expected public site text after hydration");
      assert.deepEqual(uncaught, [], "Browser page errors on " + path);
      await page.close();
      console.log("PASS browser hydration " + path + " (" + body.length + " chars)");
    }
  } finally {
    await browser.close();
  }
}

console.log("RCAT read-only standby smoke: ALL PASS");
