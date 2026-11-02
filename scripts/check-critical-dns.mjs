/**
 * Cross-project read-only DNS drift guard. Covers all *verified* public records
 * in dns-monitor.json. No external DNS-zone account access is required.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LOOKUPS = [
  { name: "Google", endpoint: "https://dns.google/resolve" },
  { name: "Cloudflare", endpoint: "https://cloudflare-dns.com/dns-query" }
];
const TYPES = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16, AAAA: 28, CAA: 257 };
const configPath = fileURLToPath(new URL("./dns-monitor.json", import.meta.url));

export function canonical(value, type) {
  const s = String(value).trim().replace(/^"|"$/g, "").toLowerCase();
  return type === "TXT" ? s : s.replace(/\.$/, "");
}
export function recordsOfType(json, type, name) {
  return [
    ...new Set(
      (json.Answer || [])
        .filter((r) => r.type === TYPES[type] && String(r.name).toLowerCase().replace(/\.$/, "") === name.toLowerCase())
        .map((r) => canonical(r.data, type))
    )
  ].sort();
}
export function judgeDns(json, check) {
  if (json.Status !== 0) return { ok: false, reason: "DNS status " + json.Status, actual: [] };
  const actual = recordsOfType(json, check.type, check.name);
  const expected = (check.expected || []).map((v) => canonical(v, check.type)).sort();
  const ok =
    check.policy === "exact"
      ? actual.join("|") === expected.join("|")
      : check.policy === "contains"
        ? expected.every((v) => actual.includes(v))
        : check.policy === "present"
          ? actual.length > 0
          : false;
  return { ok, reason: actual.length ? actual.join(", ") : "NO ANSWER", actual };
}
export async function queryDoH(endpoint, name, type, fetchImpl = fetch) {
  const url = new URL(endpoint);
  url.searchParams.set("name", name);
  url.searchParams.set("type", type);
  const r = await fetchImpl(url, { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error("DoH status " + r.status);
  const body = await r.json();
  if (typeof body.Status !== "number") throw new Error("Invalid DoH response");
  return body;
}
export async function runDnsGuard({
  fetchImpl = fetch,
  config = JSON.parse(readFileSync(configPath, "utf8")),
  strictAnyflip = false,
  logger = console
} = {}) {
  if (config.version !== 1 || !Array.isArray(config.checks) || !config.checks.length)
    throw Error("Invalid DNS monitor inventory");
  let critical = 0,
    warnings = 0,
    degraded = 0;
  const summary = [
    "## Cross-project RCAT DNS drift monitoring",
    "",
    "> Registered public-service inventory only; names not listed are not automatically discovered.",
    "",
    "| Resolver | Host | Type | Status |",
    "| --- | --- | --- | --- |"
  ];
  const checks = await Promise.all(
    config.checks.flatMap((check) =>
      LOOKUPS.map(async (lookup) => {
        try {
          const result = judgeDns(await queryDoH(lookup.endpoint, check.name, check.type, fetchImpl), check);
          return { check, lookup: lookup.name, ...result, reachable: true };
        } catch (e) {
          return { check, lookup: lookup.name, reachable: false, ok: false, reason: String(e.message || e) };
        }
      })
    )
  );
  for (const x of checks) {
    const severity = strictAnyflip && x.check.owner === "incident-786" ? "critical" : x.check.severity;
    const flag = !x.reachable ? "RESOLVER-ERROR" : x.ok ? "PASS" : severity === "warning" ? "WARNING" : "CRITICAL";
    logger.log(flag + " " + x.lookup + " " + x.check.name + " " + x.check.type + " => " + x.reason);
    summary.push("| " + x.lookup + " | " + x.check.name + " | " + x.check.type + " | " + flag + " |");
    if (!x.reachable) degraded++;
    else if (!x.ok && severity === "critical") critical++;
    else if (!x.ok) warnings++;
  }
  if (checks.every((x) => !x.reachable)) critical++;
  if (warnings) logger.warn("::warning::AnyFlip DNS regression remains open (issue #786)");
  if (degraded) logger.warn("::warning::One or more DNS resolvers unavailable: monitoring visibility degraded");
  summary.push(
    "",
    "Critical deviations: " + critical + "; known warnings: " + warnings + "; resolver failures: " + degraded
  );
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
  return critical ? 1 : 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDnsGuard({ strictAnyflip: process.env.RCAT_ANYFLIP_DNS_STRICT === "true" })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
