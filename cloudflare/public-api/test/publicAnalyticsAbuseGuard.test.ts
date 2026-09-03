// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  enforcePublicAnalyticsRateLimit,
  PublicAnalyticsRateLimitExceeded,
  PublicAnalyticsRateLimitUnavailable
} from "../src/analyticsAbuseGuard";

function createRateLimiter(outcomes: boolean[] = [true]) {
  const keys: string[] = [];
  let call = 0;
  const limiter = {
    async limit({ key }: { key: string }) {
      keys.push(key);
      const success = outcomes[Math.min(call, outcomes.length - 1)] ?? true;
      call += 1;
      return { success };
    }
  } as RateLimit;

  return { limiter, keys };
}

describe("public analytics abuse guard", () => {
  it("uses the Worker rate-limit binding without persisting counters in D1", async () => {
    const state = createRateLimiter([true, true, false]);
    const env = { PUBLIC_SITE_VIEW_RATE_LIMITER: state.limiter };
    const request = new Request("https://worker.example.test/api/public/site-view", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });

    await expect(enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view" })).resolves.toBeUndefined();
    await expect(enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view" })).resolves.toBeUndefined();
    await expect(enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view" })).rejects.toBeInstanceOf(
      PublicAnalyticsRateLimitExceeded
    );

    expect(state.keys).toHaveLength(3);
    expect(new Set(state.keys).size).toBe(1);
    expect(state.keys[0]).toMatch(/^v1_[a-f0-9]{40}$/);
    expect(state.keys[0]).not.toContain("203.0.113.10");
  });

  it("keeps the runtime incident limiter isolated from public view counters", async () => {
    const siteView = createRateLimiter();
    const incident = createRateLimiter();
    const env = {
      PUBLIC_SITE_VIEW_RATE_LIMITER: siteView.limiter,
      RUNTIME_INCIDENT_RATE_LIMITER: incident.limiter
    };
    const request = new Request("https://worker.example.test/api/public/runtime-incident", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });

    await enforcePublicAnalyticsRateLimit(request, env, { scope: "runtime-incident" });

    expect(siteView.keys).toHaveLength(0);
    expect(incident.keys).toHaveLength(1);
    expect(incident.keys[0]).toMatch(/^v1_[a-f0-9]{40}$/);
  });

  it("does not invent an IP when Cloudflare client metadata is absent", async () => {
    const state = createRateLimiter();
    const env = { PUBLIC_SITE_VIEW_RATE_LIMITER: state.limiter };
    const request = new Request("https://worker.example.test/api/public/site-view");

    await expect(enforcePublicAnalyticsRateLimit(request, env, { scope: "site-view" })).resolves.toBeUndefined();
    expect(state.keys).toHaveLength(0);
  });

  it("allows local and unit-test callers without a runtime rate-limit binding", async () => {
    const request = new Request("https://worker.example.test/api/public/presence", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });

    await expect(enforcePublicAnalyticsRateLimit(request, {}, { scope: "presence" })).resolves.toBeUndefined();
  });

  it("fails closed when a production rate-limit binding is missing", async () => {
    const request = new Request("https://worker.example.test/api/public/content-view", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });

    await expect(
      enforcePublicAnalyticsRateLimit(request, { ENVIRONMENT: "production" }, { scope: "content-view" })
    ).rejects.toBeInstanceOf(PublicAnalyticsRateLimitUnavailable);
  });

  it("fails closed when the production runtime incident limiter is missing", async () => {
    const request = new Request("https://worker.example.test/api/public/runtime-incident", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });

    await expect(
      enforcePublicAnalyticsRateLimit(request, { ENVIRONMENT: "production" }, { scope: "runtime-incident" })
    ).rejects.toBeInstanceOf(PublicAnalyticsRateLimitUnavailable);
  });

  it("maps runtime binding failures to an unavailable guard", async () => {
    const limiter = {
      async limit() {
        throw new Error("rate limit service unavailable");
      }
    } as RateLimit;
    const request = new Request("https://worker.example.test/api/public/site-view", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });

    await expect(
      enforcePublicAnalyticsRateLimit(request, { PUBLIC_SITE_VIEW_RATE_LIMITER: limiter }, { scope: "site-view" })
    ).rejects.toBeInstanceOf(PublicAnalyticsRateLimitUnavailable);
  });
});
