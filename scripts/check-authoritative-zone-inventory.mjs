/**
 * Full-zone Cloudflare DNS inventory drift detector. Read-only, no mutations.
 * Only the actual owner ACTIVE zone is valid; never use the duplicate pending zone.
 * Capture: RCAT_AUTH_DNS_READ_TOKEN=... RCAT_AUTH_DNS_ZONE_ID=... \
 *   node scripts/check-authoritative-zone-inventory.mjs capture /tmp/approved-dns-baseline.json
 * Approve and store that snapshot before enforcing it in CI.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const digest = (value) => createHash("sha256").update(String(value)).digest("hex");
export function fingerprintRecords(records) {
  return records
    .map((r) => ({
      name: String(r.name).toLowerCase(),
      type: String(r.type).toUpperCase(),
      contentSha256: digest(String(r.content).trim()),
      proxied: r.proxied === true,
      ttl: r.proxied === true ? "auto" : r.ttl,
      priority: typeof r.priority === "number" ? r.priority : null
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export async function fetchFullZone({ zoneId, token, fetchImpl = fetch }) {
  if (!/^[a-f0-9]{32}$/i.test(zoneId)) throw Error("Invalid ACTIVE zone identifier");
  const records = [];
  for (let page = 1; page <= 100; page++) {
    const url = "https://api.cloudflare.com/client/v4/zones/" + zoneId + "/dns_records?per_page=100&page=" + page;
    const response = await fetchImpl(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      signal: AbortSignal.timeout(9000)
    });
    if (!response.ok) throw Error("Cloudflare DNS API HTTP " + response.status);
    const payload = await response.json();
    if (!payload.success || !Array.isArray(payload.result)) throw Error("Cloudflare DNS API rejected query");
    records.push(...payload.result);
    if (page >= Number(payload.result_info?.total_pages || 1)) return records;
  }
  throw Error("DNS inventory exceeds 100 pages (fail closed)");
}
export function diffInventory(current, approved) {
  // Compare multisets: a duplicate A/TXT/MX record must not disappear unnoticed.
  const subtract = (left, right) => {
    const counts = new Map();
    for (const r of right) {
      const key = JSON.stringify(r);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return left.filter((r) => {
      const key = JSON.stringify(r),
        remaining = counts.get(key) || 0;
      if (remaining) {
        counts.set(key, remaining - 1);
        return false;
      }
      return true;
    });
  };
  const missing = subtract(approved, current);
  const added = subtract(current, approved);
  return { changed: Boolean(missing.length || added.length), missing, added };
}
export async function runInventory({
  env = process.env,
  fetchImpl = fetch,
  command = process.argv[2],
  location = process.argv[3],
  logger = console
} = {}) {
  const token = env.RCAT_AUTH_DNS_READ_TOKEN;
  const zoneId = env.RCAT_AUTH_DNS_ZONE_ID;
  if (!token || !zoneId) {
    logger.warn(
      "::warning::FULL ACTIVE ZONE NOT AUDITED: authoritative DNS:Read token and zone ID unavailable; monitored public records are only partial coverage."
    );
    if (command === "capture") throw Error("Cannot capture active zone without owner DNS read access");
    return { status: "NO_OWNER_ACCESS", code: 0 };
  }
  const current = fingerprintRecords(await fetchFullZone({ zoneId, token, fetchImpl }));
  if (command === "capture") {
    if (!location) throw Error("Provide explicit local output path");
    writeFileSync(
      location,
      JSON.stringify(
        {
          version: 1,
          zoneId,
          source: "authoritative-cloudflare-zone-dns-read",
          records: current
        },
        null,
        2
      ) + "\n",
      { flag: "wx", mode: 0o600 }
    );
    logger.log("Captured " + current.length + " real ACTIVE-zone DNS records for approval. Content values hashed.");
    return { status: "CAPTURED", code: 0 };
  }
  const baselinePath = location || "config/authoritative-zone-dns-baseline.json";
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch {
    logger.error(
      "FULL ZONE COVERAGE NOT ENABLED: no approved ACTIVE-zone DNS baseline; do not treat public-only checks as exhaustive."
    );
    return { status: "BASELINE_MISSING", code: 1 };
  }
  if (
    baseline.version !== 1 ||
    baseline.zoneId !== zoneId ||
    baseline.source !== "authoritative-cloudflare-zone-dns-read" ||
    !Array.isArray(baseline.records) ||
    !baseline.records.length
  ) {
    throw Error("Empty/wrong baseline: never trust provider/pending zone as authoritative");
  }
  const diff = diffInventory(current, baseline.records);
  if (diff.changed) {
    logger.error(
      "CRITICAL authoritative-zone DNS drift; changed/new=" +
        diff.added.length +
        ", removed/changed=" +
        diff.missing.length
    );
    for (const r of diff.added) logger.error("ADDED/CHANGED " + r.type + " " + r.name + " (record content suppressed)");
    for (const r of diff.missing)
      logger.error("REMOVED/CHANGED " + r.type + " " + r.name + " (record content suppressed)");
    return { status: "DRIFT", code: 1 };
  }
  logger.log("PASS exhaustive authoritative-zone DNS inventory: " + current.length + " records unchanged.");
  return { status: "PASS", code: 0 };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runInventory()
    .then((result) => {
      process.exitCode = result.code;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
