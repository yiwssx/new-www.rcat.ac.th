import assert from "node:assert/strict";
import { test } from "node:test";
import { planCacheCleanup } from "./cleanup-actions-caches.mjs";

const HOUR = 60 * 60 * 1000;
const now = Date.parse("2026-10-22T10:00:00.000Z");
const gib = 1024 ** 3;

function cache(id, key, ageHours, size = gib, ref = "refs/heads/main") {
  const timestamp = new Date(now - ageHours * HOUR).toISOString();
  return { id, key, ref, size_in_bytes: size, created_at: timestamp, last_accessed_at: timestamp };
}

test("keeps the newest three CodeQL and two pnpm entries on main", () => {
  const caches = [
    ...Array.from({ length: 7 }, (_, i) => cache(i + 1, `codeql-overlay-base-database-1-x-javascript-key-${i}`, i + 1)),
    ...Array.from({ length: 4 }, (_, i) => cache(i + 11, `node-cache-Linux-x64-pnpm-${i}`, i + 1))
  ];
  const plan = planCacheCleanup(caches, { now });
  assert.equal(plan.thresholdReached, true);
  assert.deepEqual(new Set(plan.selected.map((entry) => entry.id)), new Set([4, 5, 6, 7, 14]));
});

test("does not remove unknown keys or recently used entries", () => {
  const caches = [
    cache(1, "unknown-important-cache", 100, 9 * gib),
    ...Array.from({ length: 5 }, (_, i) => cache(i + 2, `codeql-overlay-base-database-1-x-javascript-${i}`, i * 0.2))
  ];
  assert.deepEqual(planCacheCleanup(caches, { now }).selected, []);
});

test("does nothing below threshold and keeps references isolated", () => {
  const caches = [
    cache(1, "node-cache-Linux-x64-pnpm-old", 90, gib),
    cache(2, "node-cache-Linux-x64-pnpm-new", 30, gib),
    cache(3, "node-cache-Linux-x64-pnpm-pr-old", 90, gib, "refs/pull/123/merge"),
    cache(4, "node-cache-Linux-x64-pnpm-pr-new", 10, gib, "refs/pull/123/merge")
  ];
  assert.deepEqual(planCacheCleanup(caches, { now }).selected, []);
});

test("refuses invalid records and partial data", () => {
  assert.throws(() => planCacheCleanup([{ key: "node-cache-pnpm" }], { now }));
  assert.throws(() => planCacheCleanup(null, { now }));
});
