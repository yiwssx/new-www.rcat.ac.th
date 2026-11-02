import test from "node:test";
import assert from "node:assert/strict";
import {
  fingerprintRecords,
  diffInventory,
  fetchFullZone,
  runInventory
} from "./check-authoritative-zone-inventory.mjs";
const zoneId = "0123456789abcdef0123456789abcdef";
test("whole-zone inventory detects added, removed and modified record/proxy values", () => {
  const old = fingerprintRecords([
    { name: "rms.rcat.ac.th", type: "A", content: "202.29.239.145", proxied: false, ttl: 300 }
  ]);
  const proxy = fingerprintRecords([
    { name: "rms.rcat.ac.th", type: "A", content: "202.29.239.145", proxied: true, ttl: 1 }
  ]);
  assert.equal(diffInventory(proxy, old).changed, true);
  assert.equal(diffInventory(old, old).changed, false);
  assert.equal(diffInventory(old.concat(old), old).changed, true);
  assert.equal(diffInventory([], old).changed, true);
  assert.equal(
    diffInventory(
      fingerprintRecords([{ name: "new.rcat.ac.th", type: "A", content: "203.0.113.14", proxied: false, ttl: 300 }]),
      old
    ).changed,
    true
  );
});
test("DNS record values are never written in cleartext to a snapshot", () => {
  const values = fingerprintRecords([{ name: "rcat.ac.th", type: "TXT", content: "opaque-value", ttl: 300 }]);
  assert.equal(JSON.stringify(values).includes("opaque-value"), false);
});
test("owner Cloudflare DNS API 403 rejects inventory reads", async () => {
  await assert.rejects(
    fetchFullZone({ zoneId, token: "fake", fetchImpl: async () => ({ ok: false, status: 403 }) }),
    /403/
  );
});
test("lack of owner token is labeled as incomplete, not a full audit", async () => {
  const result = await runInventory({ env: {}, logger: { log() {}, warn() {}, error() {} } });
  assert.equal(result.status, "NO_OWNER_ACCESS");
});
