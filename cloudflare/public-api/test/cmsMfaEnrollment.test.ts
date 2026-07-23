// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateRecoveryCodes } from "../src/auth/cmsMfaCrypto";
import { getMfaChallengeExpiry } from "../src/auth/cmsMfaChallenge";
import { createTotpUri, generateTotpSecret } from "../src/auth/cmsTotp";

describe("CMS MFA enrollment", () => {
  it("uses a strict ten-minute enrollment challenge and never puts the secret in the label", () => {
    const now = new Date("2026-07-23T03:00:00.000Z");
    expect(getMfaChallengeExpiry("enrollment", now).getTime() - now.getTime()).toBe(10 * 60 * 1000);
    const secret = generateTotpSecret();
    const uri = createTotpUri(secret, "root@example.invalid");
    expect(new URL(uri).searchParams.get("secret")).toBe(secret);
    expect(decodeURIComponent(new URL(uri).pathname)).toBe("/Roi-Et College CMS:root@example.invalid");
  });

  it("returns ten distinct one-time recovery values for a completed enrollment", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });
});
