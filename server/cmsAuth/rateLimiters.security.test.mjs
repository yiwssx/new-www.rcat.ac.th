import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCmsLoginRateLimitKeys, createCmsLifecycleRateLimitKeys } from "./rateLimiters.mjs";

describe("CMS rate-limit key contract (CodeQL S07)", () => {
  it("derives opaque HMAC-SHA256 keys instead of persisting raw user or IP inputs", () => {
    const secret = "test-only-rate-limit-key";
    const identifier = "person@example.invalid";
    const clientIp = "192.0.2.7";
    const keys = createCmsLoginRateLimitKeys({ identifier, clientIp, secret });

    expect(keys.identifierKey).toBe(
      createHmac("sha256", secret).update(`cms-identifier:${identifier}|${clientIp}`).digest("hex")
    );
    expect(keys.ipKey).toBe(createHmac("sha256", secret).update(`cms-ip:${clientIp}`).digest("hex"));
    expect(keys.identifierKey).toMatch(/^[0-9a-f]{64}$/);
    expect(keys.ipKey).toMatch(/^[0-9a-f]{64}$/);
    expect(keys.identifierKey).not.toContain(identifier);
    expect(keys.ipKey).not.toContain(clientIp);
    expect(createCmsLoginRateLimitKeys({ identifier, clientIp, secret: "different-secret" })).not.toEqual(keys);
  });

  it("uses the same secret-keyed derivation for lifecycle rate limits", () => {
    const keys = createCmsLifecycleRateLimitKeys({
      clientIp: "192.0.2.7",
      secret: "test-only-rate-limit-key",
      withFailure: true
    });

    expect(keys.attemptKey).toMatch(/^[0-9a-f]{64}$/);
    expect(keys.failureKey).toMatch(/^[0-9a-f]{64}$/);
    expect(keys.attemptKey).not.toBe(keys.failureKey);
  });
});
