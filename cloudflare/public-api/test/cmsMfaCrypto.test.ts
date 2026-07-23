// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  validateMfaEncryptionConfiguration
} from "../src/auth/cmsMfaCrypto";

const key = "A".repeat(43);

describe("CMS MFA crypto", () => {
  it("accepts only a canonical 32-byte key and safe key version", () => {
    expect(() => validateMfaEncryptionConfiguration(key, "v1")).not.toThrow();
    expect(() => validateMfaEncryptionConfiguration("short", "v1")).toThrow("CMS MFA encryption key is unavailable");
    expect(() => validateMfaEncryptionConfiguration(key, "bad/version")).toThrow(
      "CMS MFA encryption key version is unavailable"
    );
  });

  it("round-trips a TOTP secret with AES-256-GCM and bound AAD", async () => {
    const encrypted = await encryptTotpSecret({
      secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
      userId: "admin-user-1",
      encryptionKey: key,
      keyVersion: "v1"
    });
    expect(encrypted.iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(encrypted.encryptedSecret).not.toContain("JBSWY");
    await expect(
      decryptTotpSecret({
        ...encrypted,
        userId: "admin-user-1",
        storedKeyVersion: "v1",
        encryptionKey: key,
        configuredKeyVersion: "v1"
      })
    ).resolves.toBe("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP");
  });

  it("fails closed for a changed user, key version, IV, or ciphertext", async () => {
    const encrypted = await encryptTotpSecret({
      secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
      userId: "admin-user-1",
      encryptionKey: key,
      keyVersion: "v1"
    });
    await expect(
      decryptTotpSecret({
        ...encrypted,
        userId: "admin-user-2",
        storedKeyVersion: "v1",
        encryptionKey: key,
        configuredKeyVersion: "v1"
      })
    ).rejects.toThrow();
    await expect(
      decryptTotpSecret({
        ...encrypted,
        userId: "admin-user-1",
        storedKeyVersion: "v2",
        encryptionKey: key,
        configuredKeyVersion: "v1"
      })
    ).rejects.toThrow();
    await expect(
      decryptTotpSecret({
        ...encrypted,
        iv: `${encrypted.iv.slice(0, -1)}${encrypted.iv.endsWith("A") ? "B" : "A"}`,
        userId: "admin-user-1",
        storedKeyVersion: "v1",
        encryptionKey: key,
        configuredKeyVersion: "v1"
      })
    ).rejects.toThrow("CMS MFA secret could not be decrypted");
    await expect(
      decryptTotpSecret({
        ...encrypted,
        encryptedSecret: `${encrypted.encryptedSecret.slice(0, -1)}${
          encrypted.encryptedSecret.endsWith("A") ? "B" : "A"
        }`,
        userId: "admin-user-1",
        storedKeyVersion: "v1",
        encryptionKey: key,
        configuredKeyVersion: "v1"
      })
    ).rejects.toThrow("CMS MFA secret could not be decrypted");
  });

  it("creates exactly ten 128-bit recovery codes with strict normalization and domain hashes", async () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-Z2-7]{5}(?:-[A-Z2-7]{5}){4}-[A-Z2-7]$/.test(code))).toBe(true);
    expect(normalizeRecoveryCode(codes[0].toLowerCase())).toBe(codes[0].replace(/-/g, ""));
    expect(normalizeRecoveryCode(` ${codes[0]} `)).toBeNull();
    expect(normalizeRecoveryCode("O0000-00000-00000-00000-00000-0")).toBeNull();
    const codeHash = await hashRecoveryCode(codes[0]);
    expect(codeHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(codeHash).not.toBe(codes[0]);
    expect(await hashRecoveryCode(codes[0])).toBe(codeHash);
    expect(normalizeRecoveryCode(`${codes[0]}!`)).toBeNull();
  });
});
