// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  constantTimeTextEqual,
  fixedSizeBase64UrlEqual,
  fixedSizeBytesEqual,
  generateCmsCsrfToken,
  generateCmsSessionToken,
  hashCmsClientIp,
  hashCmsCsrfToken,
  hashCmsSessionToken,
  hashCmsUserAgent,
  isValidCmsToken
} from "../src/auth/cmsSessionCrypto";

const testSecret = "test-only-cms-proxy-secret-repeated-000000000000";

describe("CMS session cryptography", () => {
  it("generates independent 256-bit Session and CSRF tokens as 43-character base64url", () => {
    const sessionToken = generateCmsSessionToken();
    const csrfToken = generateCmsCsrfToken();

    expect(sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(sessionToken, "base64url")).toHaveLength(32);
    expect(Buffer.from(csrfToken, "base64url")).toHaveLength(32);
    expect(sessionToken).not.toBe(csrfToken);
  });

  it("hashes deterministically while separating Session and CSRF domains", async () => {
    const token = generateCmsSessionToken();
    const first = await hashCmsSessionToken(token);
    const second = await hashCmsSessionToken(token);
    const csrfHash = await hashCmsCsrfToken(token);

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(token);
    expect(csrfHash).not.toBe(first);
  });

  it.each(["", "a".repeat(42), "a".repeat(44), "a".repeat(42) + "=", "%".repeat(43), 123])(
    "rejects malformed token %j",
    (token) => {
      expect(isValidCmsToken(token)).toBe(false);
    }
  );

  it("uses separately domain-separated HMAC-SHA256 values for IP and User-Agent metadata", async () => {
    const ip = "192.0.2.10";
    const userAgent = "test-browser/1.0";
    const ipHash = await hashCmsClientIp(ip, testSecret);
    const repeatedIpHash = await hashCmsClientIp(ip, testSecret);
    const userAgentHash = await hashCmsUserAgent(userAgent, testSecret);

    expect(ipHash).toBe(repeatedIpHash);
    expect(ipHash).not.toBe(userAgentHash);
    expect(ipHash).not.toContain(ip);
    expect(userAgentHash).not.toContain(userAgent);
    expect(ipHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("compares fixed-size values without accepting mismatches", async () => {
    const token = generateCmsSessionToken();
    const other = generateCmsSessionToken();

    expect(fixedSizeBytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(fixedSizeBytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(fixedSizeBytesEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
    expect(fixedSizeBase64UrlEqual(token, token)).toBe(true);
    expect(fixedSizeBase64UrlEqual(token, other)).toBe(false);
    await expect(constantTimeTextEqual("same", "same")).resolves.toBe(true);
    await expect(constantTimeTextEqual("same", "different")).resolves.toBe(false);
  });

  it("keeps malformed-token errors generic and free of cryptographic material", async () => {
    const malformed = `private-input-${"x".repeat(50)}`;
    let message = "";

    try {
      await hashCmsSessionToken(malformed);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("invalid CMS token");
    expect(message).not.toContain(malformed);
    expect(message).not.toMatch(/digest|intermediate|SHA-256/i);
  });
});
