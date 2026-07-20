// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  LOGIN_BLOCK_MS,
  MAX_FAILURES_PER_IDENTITY,
  MAX_FAILURES_PER_IP,
  createLegacyLoginRateLimiter,
  createLegacyLoginRateLimitKeys,
  getLegacyLoginClientIp
} from "./loginRateLimit.mjs";

const SESSION_SECRET = "fake-admin-proxy-session-secret-32-characters";
const START_MS = Date.parse("2026-06-19T05:00:00.000Z");

function makeRequest(headers = {}) {
  return {
    headers: Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
  };
}

function makeKeys(email = "admin@example.test", ip = "192.0.2.1") {
  return createLegacyLoginRateLimitKeys({
    email,
    request: makeRequest({ "x-vercel-forwarded-for": ip }),
    secret: SESSION_SECRET
  });
}

describe("legacy admin login rate limiter", () => {
  it("allows the first four identity failures and blocks on the fifth", () => {
    const limiter = createLegacyLoginRateLimiter();
    const keys = makeKeys();

    for (let attempt = 1; attempt < MAX_FAILURES_PER_IDENTITY; attempt += 1) {
      expect(limiter.recordFailure(keys, START_MS)).toEqual({ blocked: false, retryAfterSeconds: 0 });
    }

    expect(limiter.recordFailure(keys, START_MS)).toEqual({ blocked: true, retryAfterSeconds: 900 });
  });

  it("keeps an identity blocked during the interval and admits it at expiration", () => {
    const limiter = createLegacyLoginRateLimiter();
    const keys = makeKeys();

    for (let attempt = 0; attempt < MAX_FAILURES_PER_IDENTITY; attempt += 1) {
      limiter.recordFailure(keys, START_MS);
    }

    expect(limiter.check(keys, START_MS + LOGIN_BLOCK_MS - 1).blocked).toBe(true);
    expect(limiter.check(keys, START_MS + LOGIN_BLOCK_MS)).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it("blocks distributed identity attempts at the per-IP threshold", () => {
    const limiter = createLegacyLoginRateLimiter();
    let result;

    for (let attempt = 0; attempt < MAX_FAILURES_PER_IP; attempt += 1) {
      result = limiter.recordFailure(makeKeys(`admin-${attempt}@example.test`), START_MS);
    }

    expect(result).toEqual({ blocked: true, retryAfterSeconds: 900 });
  });

  it("resets only the successful identity bucket and preserves IP-wide failures", () => {
    const limiter = createLegacyLoginRateLimiter({ maxFailuresPerIdentity: 3, maxFailuresPerIp: 3 });
    const firstIdentity = makeKeys("first@example.test");
    const secondIdentity = makeKeys("second@example.test");

    limiter.recordFailure(firstIdentity, START_MS);
    limiter.recordFailure(firstIdentity, START_MS);
    expect(limiter.getSnapshotForTests(START_MS).size).toBe(2);
    limiter.recordSuccess(firstIdentity, START_MS);
    expect(limiter.getSnapshotForTests(START_MS).size).toBe(1);

    expect(limiter.recordFailure(firstIdentity, START_MS).blocked).toBe(true);
    expect(limiter.check(secondIdentity, START_MS).blocked).toBe(true);
  });

  it("bounds bucket memory and prunes expired state", () => {
    const limiter = createLegacyLoginRateLimiter({ maxBuckets: 4 });

    for (let index = 1; index <= 10; index += 1) {
      limiter.recordFailure(makeKeys(`admin-${index}@example.test`, `192.0.2.${index}`), START_MS + index);
      expect(limiter.getSnapshotForTests(START_MS + index).size).toBeLessThanOrEqual(4);
    }

    expect(limiter.getSnapshotForTests(START_MS + LOGIN_BLOCK_MS + 100).size).toBe(0);
  });

  it("stores only HMAC keys and never exposes raw email or IP values", () => {
    const limiter = createLegacyLoginRateLimiter();
    const rawEmail = "sensitive-admin@example.test";
    const rawIp = "203.0.113.99";
    const keys = makeKeys(rawEmail, rawIp);

    limiter.recordFailure(keys, START_MS);
    const serializedState = JSON.stringify(limiter.getSnapshotForTests(START_MS));

    expect(serializedState).not.toContain(rawEmail);
    expect(serializedState).not.toContain(rawIp);
    expect(keys.ipKey).toMatch(/^[a-f0-9]{64}$/);
    expect(keys.identityKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps normal buckets separate by IP and uses a stable unknown-IP fallback", () => {
    const firstIp = makeKeys("admin@example.test", "192.0.2.1");
    const secondIp = makeKeys("admin@example.test", "192.0.2.2");
    const missingIpA = createLegacyLoginRateLimitKeys({
      email: "admin@example.test",
      request: makeRequest(),
      secret: SESSION_SECRET
    });
    const missingIpB = createLegacyLoginRateLimitKeys({
      email: "admin@example.test",
      request: makeRequest(),
      secret: SESSION_SECRET
    });

    expect(firstIp.ipKey).not.toBe(secondIp.ipKey);
    expect(firstIp.identityKey).not.toBe(secondIp.identityKey);
    expect(missingIpA).toEqual(missingIpB);
    expect(getLegacyLoginClientIp(makeRequest())).toBe("unknown");
  });

  it("normalizes forwarded addresses in priority order and rejects malformed values", () => {
    expect(
      getLegacyLoginClientIp(
        makeRequest({
          "x-vercel-forwarded-for": " 192.0.2.50, 198.51.100.1 ",
          "x-forwarded-for": "192.0.2.60",
          "x-real-ip": "192.0.2.70"
        })
      )
    ).toBe("192.0.2.50");
    expect(getLegacyLoginClientIp(makeRequest({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
    expect(getLegacyLoginClientIp(makeRequest({ "x-real-ip": `192.0.2.1${String.fromCharCode(7)}` }))).toBe("unknown");
  });

  it("returns a positive Retry-After bounded by the configured block interval", () => {
    const limiter = createLegacyLoginRateLimiter({ maxFailuresPerIdentity: 1 });
    const keys = makeKeys();

    limiter.recordFailure(keys, START_MS);
    const result = limiter.check(keys, START_MS + 1234);

    expect(result.blocked).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(LOGIN_BLOCK_MS / 1000);
  });
});
