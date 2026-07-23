// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createTotpUri,
  decodeTotpSecret,
  encodeTotpSecret,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode
} from "../src/auth/cmsTotp";

const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("CMS TOTP", () => {
  it.each([
    [59_000, "287082"],
    [1_111_111_109_000, "081804"],
    [1_111_111_111_000, "050471"],
    [1_234_567_890_000, "005924"],
    [2_000_000_000_000, "279037"],
    [20_000_000_000_000, "353130"]
  ])("matches the RFC 6238 SHA-1 vector at %i milliseconds", async (timestamp, expected) => {
    expect(await generateTotpCode(rfcSecret, timestamp)).toBe(expected);
  });

  it("accepts only six ASCII digits in the plus-or-minus-one-step window", async () => {
    const timestamp = 1_234_567_890_000;
    const previous = await generateTotpCode(rfcSecret, timestamp - 30_000);
    const next = await generateTotpCode(rfcSecret, timestamp + 30_000);
    expect(await verifyTotpCode(previous, rfcSecret, timestamp)).toEqual({
      matchedStep: Math.floor(timestamp / 1000 / 30) - 1
    });
    expect(await verifyTotpCode(next, rfcSecret, timestamp)).toEqual({
      matchedStep: Math.floor(timestamp / 1000 / 30) + 1
    });
    expect(await verifyTotpCode("１２３４５６", rfcSecret, timestamp)).toBeNull();
    expect(await verifyTotpCode("12345", rfcSecret, timestamp)).toBeNull();
  });

  it("generates a 20-byte uppercase unpadded secret and normalized issuer URI", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(createTotpUri(secret, " ADMIN@Example.Invalid ")).toBe(
      `otpauth://totp/Roi-Et%20College%20CMS%3Aadmin%40example.invalid?secret=${secret}&issuer=Roi-Et%20College%20CMS&algorithm=SHA1&digits=6&period=30`
    );
  });

  it("round-trips canonical Base32 and rejects malformed encodings", () => {
    const bytes = Uint8Array.from({ length: 20 }, (_, index) => index);
    const encoded = encodeTotpSecret(bytes);
    expect(decodeTotpSecret(encoded)).toEqual(bytes);
    expect(() => decodeTotpSecret(`${encoded}=`)).toThrow("TOTP secret is invalid");
    expect(() => decodeTotpSecret("ABC")).toThrow("TOTP secret is not canonical Base32");
  });
});
