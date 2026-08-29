// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  enforceSecurityRateLimit,
  SecurityRateLimitExceeded,
  SecurityRateLimitUnavailable
} from "../src/securityRateLimit";

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

function request() {
  return new Request("https://worker.example.test/api/internal/cms-auth/login", {
    headers: { "X-RCAT-CMS-Client-IP": "203.0.113.20" }
  });
}

describe("P6B security rate limit", () => {
  it("hashes trusted proxy client metadata before calling the CMS limiter", async () => {
    const state = createRateLimiter([true, false]);
    const env = { CMS_AUTH_RATE_LIMITER: state.limiter };

    await expect(enforceSecurityRateLimit(request(), env, "cms-auth")).resolves.toBeUndefined();
    await expect(enforceSecurityRateLimit(request(), env, "cms-auth")).rejects.toBeInstanceOf(
      SecurityRateLimitExceeded
    );

    expect(state.keys).toHaveLength(2);
    expect(state.keys[0]).toMatch(/^v1_[a-f0-9]{40}$/);
    expect(state.keys[0]).not.toContain("203.0.113.20");
  });

  it("keeps CMS and Admin API namespaces isolated", async () => {
    const cms = createRateLimiter();
    const admin = createRateLimiter();
    const env = { CMS_AUTH_RATE_LIMITER: cms.limiter, ADMIN_API_RATE_LIMITER: admin.limiter };

    await enforceSecurityRateLimit(request(), env, "cms-auth");
    await enforceSecurityRateLimit(request(), env, "admin-api");

    expect(cms.keys).toHaveLength(1);
    expect(admin.keys).toHaveLength(1);
    expect(cms.keys[0]).not.toBe(admin.keys[0]);
  });

  it("allows tests without bindings but fails closed in production", async () => {
    await expect(enforceSecurityRateLimit(request(), {}, "cms-auth")).resolves.toBeUndefined();
    await expect(enforceSecurityRateLimit(request(), { ENVIRONMENT: "production" }, "cms-auth")).rejects.toBeInstanceOf(
      SecurityRateLimitUnavailable
    );
  });

  it("fails closed when trusted proxy client metadata is absent in production", async () => {
    const limiter = createRateLimiter();
    const env = { ENVIRONMENT: "production", ADMIN_API_RATE_LIMITER: limiter.limiter };
    const missingMetadata = new Request("https://worker.example.test/api/admin/content");

    await expect(enforceSecurityRateLimit(missingMetadata, env, "admin-api")).rejects.toBeInstanceOf(
      SecurityRateLimitUnavailable
    );
    expect(limiter.keys).toHaveLength(0);
  });
});
