// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  generateInvitationToken,
  generatePasswordResetToken,
  hashInvitationToken,
  hashPasswordResetToken,
  isValidLifecycleToken
} from "../src/auth/cmsLifecycleToken";

function decode(token: string) {
  return Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

describe("CMS lifecycle-token cryptography", () => {
  it("uses 32 random bytes for invitation tokens", () => {
    expect(decode(generateInvitationToken())).toHaveLength(32);
  });

  it("uses 32 random bytes for password-reset tokens", () => {
    expect(decode(generatePasswordResetToken())).toHaveLength(32);
  });

  it("encodes tokens as exactly 43 base64url characters without padding", () => {
    expect(generateInvitationToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generates distinct tokens", () => {
    expect(generateInvitationToken()).not.toBe(generateInvitationToken());
  });

  it("hashes invitation tokens deterministically", async () => {
    const token = generateInvitationToken();
    expect(await hashInvitationToken(token)).toBe(await hashInvitationToken(token));
  });

  it("hashes reset tokens deterministically", async () => {
    const token = generatePasswordResetToken();
    expect(await hashPasswordResetToken(token)).toBe(await hashPasswordResetToken(token));
  });

  it("domain-separates invitation and password-reset hashes", async () => {
    const token = generateInvitationToken();
    expect(await hashInvitationToken(token)).not.toBe(await hashPasswordResetToken(token));
  });

  it.each(["", "A".repeat(42), "A".repeat(44), `${"A".repeat(42)}=`, "!".repeat(43), null])(
    "rejects malformed token %j",
    async (token) => {
      expect(isValidLifecycleToken(token)).toBe(false);
      await expect(hashInvitationToken(token)).rejects.toThrow("invalid lifecycle token");
    }
  );

  it("never returns the raw token from a hash function", async () => {
    const token = generateInvitationToken();
    expect(await hashInvitationToken(token)).not.toBe(token);
  });

  it("keeps digest data out of validation errors", async () => {
    await expect(hashPasswordResetToken("not-a-token")).rejects.toThrow(/^invalid lifecycle token$/);
  });
});
