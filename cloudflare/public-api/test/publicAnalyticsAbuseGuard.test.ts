// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  enforcePublicAnalyticsRateLimit,
  PublicAnalyticsRateLimitExceeded,
  PublicAnalyticsRateLimitSchemaMissing
} from "../src/analyticsAbuseGuard";

function createRateLimitDb(options: { missing?: boolean } = {}) {
  const counts = new Map<string, number>();

  return {
    prepare(query: string) {
      const bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bindings.push(...values);
          return this;
        },
        async run() {
          if (options.missing) throw new Error("no such table: public_write_rate_limits");
          if (/INSERT INTO public_write_rate_limits/i.test(query)) {
            const key = String(bindings[0]);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          return { success: true, meta: { changes: 1 } };
        },
        async first<T>() {
          if (options.missing) throw new Error("no such table: public_write_rate_limits");
          const key = String(bindings[0]);
          return { request_count: counts.get(key) ?? 0 } as T;
        }
      };
    }
  } as unknown as D1Database;
}

describe("public analytics abuse guard", () => {
  it("limits repeated writes from the same Cloudflare client bucket", async () => {
    const env = { DB: createRateLimitDb() };
    const request = new Request("https://worker.example.test/api/public/site-view", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });
    const now = new Date("2026-08-08T12:00:30.000Z");

    await expect(
      enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view", limit: 2, now })
    ).resolves.toBeUndefined();
    await expect(
      enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view", limit: 2, now })
    ).resolves.toBeUndefined();
    await expect(
      enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view", limit: 2, now })
    ).rejects.toBeInstanceOf(PublicAnalyticsRateLimitExceeded);
  });

  it("does not invent an IP when Cloudflare client metadata is absent", async () => {
    const env = { DB: createRateLimitDb() };
    const request = new Request("https://worker.example.test/api/public/site-view");

    await expect(
      enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view", limit: 1 })
    ).resolves.toBeUndefined();
  });

  it("reports the required migration when the rate-limit table is missing", async () => {
    const env = { DB: createRateLimitDb({ missing: true }) };
    const request = new Request("https://worker.example.test/api/public/site-view", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });

    await expect(
      enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view", limit: 1 })
    ).rejects.toBeInstanceOf(PublicAnalyticsRateLimitSchemaMissing);
  });
});
