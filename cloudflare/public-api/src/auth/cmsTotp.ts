const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_SECRET_BYTES = 20;
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;

export function encodeTotpSecret(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let result = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return result;
}

export function decodeTotpSecret(value: string) {
  if (!/^[A-Z2-7]+$/.test(value)) {
    throw new TypeError("TOTP secret is invalid");
  }

  let bits = 0;
  let buffer = 0;
  const output: number[] = [];

  for (const character of value) {
    const index = BASE32_ALPHABET.indexOf(character);
    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) {
    throw new TypeError("TOTP secret is not canonical Base32");
  }

  return Uint8Array.from(output);
}

function counterBytes(step: number) {
  if (!Number.isSafeInteger(step) || step < 0) {
    throw new TypeError("TOTP step is invalid");
  }

  const bytes = new Uint8Array(8);
  let remaining = BigInt(step);

  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 255n);
    remaining >>= 8n;
  }

  return bytes;
}

async function codeForStep(secret: string, step: number) {
  const key = await crypto.subtle.importKey("raw", decodeTotpSecret(secret), { hash: "SHA-1", name: "HMAC" }, false, [
    "sign"
  ]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(step)));
  const offset = signature[signature.length - 1] & 15;
  const binary =
    ((signature[offset] & 127) << 24) |
    ((signature[offset + 1] & 255) << 16) |
    ((signature[offset + 2] & 255) << 8) |
    (signature[offset + 3] & 255);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function digitsEqual(actual: string, expected: string) {
  let difference = actual.length ^ expected.length;
  for (let index = 0; index < TOTP_DIGITS; index += 1) {
    difference |= (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function generateTotpSecret() {
  return encodeTotpSecret(crypto.getRandomValues(new Uint8Array(TOTP_SECRET_BYTES)));
}

export function createTotpUri(secret: string, email: string) {
  if (decodeTotpSecret(secret).byteLength !== TOTP_SECRET_BYTES) {
    throw new TypeError("TOTP secret is invalid");
  }

  const issuer = "Roi-Et College CMS";
  const account = email.trim().toLowerCase();

  if (!account || account.length > 320) {
    throw new TypeError("TOTP account is invalid");
  }

  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export async function generateTotpCode(secret: string, timestampMs: number) {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new TypeError("TOTP time is invalid");
  }

  return codeForStep(secret, Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS));
}

export async function verifyTotpCode(code: unknown, secret: string, timestampMs: number) {
  if (typeof code !== "string" || !/^[0-9]{6}$/.test(code) || !Number.isFinite(timestampMs) || timestampMs < 0) {
    return null;
  }

  const currentStep = Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS);

  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const step = currentStep + offset;

    if (step >= 0 && digitsEqual(await codeForStep(secret, step), code)) {
      return { matchedStep: step };
    }
  }

  return null;
}

export const CMS_TOTP_PARAMETERS = Object.freeze({
  algorithm: "SHA1",
  digits: TOTP_DIGITS,
  periodSeconds: TOTP_PERIOD_SECONDS,
  window: TOTP_WINDOW
});
