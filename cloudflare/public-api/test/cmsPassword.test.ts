// @vitest-environment node
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  CMS_PASSWORD_ALGORITHM,
  CMS_PASSWORD_BCRYPT_COST,
  CMS_PASSWORD_DUMMY_HASH,
  CMS_PASSWORD_MAX_CODE_POINTS,
  CMS_PASSWORD_MAX_UTF8_BYTES,
  CMS_PASSWORD_MIN_CODE_POINTS,
  createCmsPasswordHasher,
  hashCmsPassword,
  validateCmsPassword,
  verifyCmsPassword
} from "../src/auth/cmsPassword";

const fastHashCmsPassword = createCmsPasswordHasher(4);

describe("CMS password hashing and policy", () => {
  it("hashes and verifies a valid password through the production-compatible algorithm path", async () => {
    const password = "valid CMS passphrase 2026";
    const hash = await hashCmsPassword(password);

    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    await expect(verifyCmsPassword(password, hash, CMS_PASSWORD_ALGORITHM)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await fastHashCmsPassword("correct horse battery staple");
    await expect(verifyCmsPassword("wrong horse battery staple", hash, CMS_PASSWORD_ALGORITHM)).resolves.toBe(false);
  });

  it("fails closed for unsupported algorithms and malformed hashes", async () => {
    const hash = await fastHashCmsPassword("correct horse battery staple");

    await expect(verifyCmsPassword("correct horse battery staple", hash, "bcrypt-v0")).resolves.toBe(false);
    await expect(
      verifyCmsPassword("correct horse battery staple", "not-a-valid-bcrypt-hash", CMS_PASSWORD_ALGORITHM)
    ).resolves.toBe(false);
  });

  it("does not trim passwords", async () => {
    const password = "  exact password value  ";
    const hash = await fastHashCmsPassword(password);

    await expect(verifyCmsPassword(password, hash, CMS_PASSWORD_ALGORITHM)).resolves.toBe(true);
    await expect(verifyCmsPassword(password.trim(), hash, CMS_PASSWORD_ALGORITHM)).resolves.toBe(false);
  });

  it("supports spaces and Unicode", async () => {
    const password = "รหัสผ่าน ผู้ดูแล ๒๕๖๙";
    const hash = await fastHashCmsPassword(password);

    expect(validateCmsPassword(password)).toEqual({ valid: true });
    await expect(verifyCmsPassword(password, hash, CMS_PASSWORD_ALGORITHM)).resolves.toBe(true);
  });

  it("enforces minimum and maximum Unicode code-point lengths", () => {
    expect(validateCmsPassword("a".repeat(CMS_PASSWORD_MIN_CODE_POINTS - 1))).toEqual({
      valid: false,
      code: "too_short"
    });
    expect(validateCmsPassword("a".repeat(CMS_PASSWORD_MAX_CODE_POINTS + 1))).toEqual({
      valid: false,
      code: "too_long"
    });
  });

  it("enforces the UTF-8 byte limit", () => {
    const password = "🛡️".repeat(Math.ceil(CMS_PASSWORD_MAX_UTF8_BYTES / 4));

    expect(new TextEncoder().encode(password).byteLength).toBeGreaterThan(CMS_PASSWORD_MAX_UTF8_BYTES);
    expect(validateCmsPassword(password)).toEqual({ valid: false, code: "too_many_bytes" });
  });

  it("rejects ASCII control characters and whitespace-only values", () => {
    expect(validateCmsPassword("valid password\u0000value")).toEqual({
      valid: false,
      code: "control_character"
    });
    expect(validateCmsPassword("            ")).toEqual({ valid: false, code: "whitespace_only" });
  });

  it("keeps passwords that share the first 72 UTF-8 bytes semantically distinct", async () => {
    const commonPrefix = "a".repeat(80);
    const firstPassword = `${commonPrefix}X-tail`;
    const secondPassword = `${commonPrefix}Y-tail`;
    const hash = await fastHashCmsPassword(firstPassword);

    await expect(verifyCmsPassword(firstPassword, hash, CMS_PASSWORD_ALGORITHM)).resolves.toBe(true);
    await expect(verifyCmsPassword(secondPassword, hash, CMS_PASSWORD_ALGORITHM)).resolves.toBe(false);
  });

  it("exports the versioned production algorithm label and fixed production cost", () => {
    expect(CMS_PASSWORD_ALGORITHM).toBe("bcrypt-sha384-v1");
    expect(CMS_PASSWORD_BCRYPT_COST).toBe(12);
    expect(bcrypt.getRounds(CMS_PASSWORD_DUMMY_HASH)).toBe(CMS_PASSWORD_BCRYPT_COST);
  });

  it("never includes a password, hash, or pre-hash in policy errors", () => {
    const password = "Zq7!";
    const result = validateCmsPassword(password);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(password);
    expect(serialized).not.toMatch(/hash|digest|prehash|pre-hash|sha-384|bcrypt/i);
    expect(result).toEqual({ valid: false, code: "too_short" });
  });
});
