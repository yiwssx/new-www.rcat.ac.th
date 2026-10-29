/* global URL, fetch, AbortSignal, Response */
// DNS-free, read-only origin readiness gate for future Cloudflare for SaaS/O2O.
// Never reaches www.rcat.ac.th, changes DNS, sends credentials, or simulates
// errors against the real Vercel deployment.
import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const VERCEL_ORIGIN = "https://new-wwwrcatacth-rcat-it-dev-team.vercel.app";
export const STANDBY_ORIGIN = "https://rcat-web-standby.rcat-digital.workers.dev";

const specs = Object.freeze([
  { name: "Vercel SSR home", origin: VERCEL_ORIGIN, path: "/", status: 200, type: "html", marker: /data-rcat-ssr=["']true["']/i },
  { name: "Vercel SSR news", origin: VERCEL_ORIGIN, path: "/news", status: 200, type: "html", marker: /data-rcat-ssr=["']true["']/i },
  { name: "Vercel public home API", origin: VERCEL_ORIGIN, path: "/api/public/home", status: 200, type: "json" },
  { name: "Vercel public shell API", origin: VERCEL_ORIGIN, path: "/api/public/shell", status: 200, type: "json" },
  { name: "Standby health", origin: STANDBY_ORIGIN, path: "/_rcat/failover-health", status: 200, type: "health" },
  { name: "Standby public CSR news", origin: STANDBY_ORIGIN, path: "/news", status: 200, type: "csr" },
  { name: "Standby public home API", origin: STANDBY_ORIGIN, path: "/api/public/home", status: 200, type: "json" },
  { name: "Standby public shell API", origin: STANDBY_ORIGIN, path: "/api/public/shell", status: 200, type: "json" },
  { name: "Standby blocks Admin", origin: STANDBY_ORIGIN, path: "/admin", status: 503, type: "blocked" },
  { name: "Standby blocks private API", origin: STANDBY_ORIGIN, path: "/api/cms-auth/session", status: 503, type: "blocked" }
]);

const ALLOWED_ORIGINS = new Set([VERCEL_ORIGIN, STANDBY_ORIGIN]);

function allowedUrl(origin, path) {
  assert.ok(ALLOWED_ORIGINS.has(origin), "Unexpected probe origin");
  assert.match(path, /^\/[a-z0-9/_-]*$/i, "Only fixed read-only paths allowed");
  const url = new URL(path, origin);
  assert.equal(url.origin, origin, "Cross-origin probe refused");
  assert.equal(url.search, "", "Do not use query parameters for live probes");
  return url;
}

async function checkOne(spec, fetchImpl) {
  const url = allowedUrl(spec.origin, spec.path);
  let response;
  try {
    response = await fetchImpl(url.href, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: spec.type === "json" || spec.type === "health" ? "application/json" : "text/html" },
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    return { name: spec.name, ok: false, reason: "network or timeout" };
  }

  if (response.status !== spec.status) {
    const redirect = response.status >= 300 && response.status < 400;
    return {
      name: spec.name,
      ok: false,
      reason: redirect ? "unexpected redirect (possible canonical/hostname loop)" : "HTTP " + response.status
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (spec.type === "json" || spec.type === "health") {
      assert.match(contentType, /application\/json/i, "JSON expected");
      const payload = await response.json();
      assert.ok(payload && typeof payload === "object" && !Array.isArray(payload), "JSON object expected");
      if (spec.type === "health") {
        assert.deepEqual(
          { service: payload.service, mode: payload.mode, status: payload.status },
          { service: "rcat-web-failover", mode: "standby", status: "ok" }
        );
      }
    } else if (spec.type === "html" || spec.type === "csr") {
      assert.match(contentType, /text\/html/i, "HTML expected");
      // A capped HTML probe must not dump private response bodies into CI logs.
      const html = (await response.text()).slice(0, 1024 * 1024);
      if (spec.type === "html") {
        assert.match(html, spec.marker, "SSR marker missing");
      } else {
        assert.match(html, /id=["']root["']/i, "CSR root missing");
        assert.match(html, /noindex/i, "Standby CSR must be noindex");
      }
    } else if (spec.type === "blocked") {
      assert.match(response.headers.get("cache-control") ?? "", /no-store/i, "Protected standby must not be cached");
      await response.body?.cancel();
    }
  } catch {
    return { name: spec.name, ok: false, reason: "invalid origin response or content-type" };
  }

  return { name: spec.name, ok: true, reason: "PASS" };
}

export async function checkOriginReadiness(fetchImpl = fetch) {
  const checks = [];
  for (const spec of specs) {
    checks.push(await checkOne(spec, fetchImpl));
  }
  return { passed: checks.every((check) => check.ok), checks };
}

export function formatReadinessReport(result) {
  const lines = [
    "### RCAT O2O — read-only external origin preflight",
    "",
    "| Probe | Result |",
    "| --- | --- |"
  ];
  for (const check of result.checks) {
    // Names and messages are fixed by local code, not remote server bodies.
    lines.push("| " + check.name + " | " + (check.ok ? "PASS" : "FAIL: " + check.reason) + " |");
  }
  lines.push(
    "",
    result.passed ? "**External origin preflight: PASS**" : "**External origin preflight: BLOCKED**",
    "",
    "This is NOT a live SaaS/O2O proof. Provider zone, SSL, domain ownership, Vercel proxy auth/cookies and cutover remain separate gates.",
    "No production DNS, Vercel, Cloudflare routes, APIs or data were changed."
  );
  return lines.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkOriginReadiness();
  const markdown = formatReadinessReport(result);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  if (!result.passed) {
    process.exitCode = 1;
  }
}
