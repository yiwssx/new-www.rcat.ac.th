const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const KEY_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;
const RECOVERY_CODE_PATTERN = /^[A-Z2-7]{26}$/;
const RECOVERY_CODE_DOMAIN = "rcat-cms-recovery-code-v1:";
const TOTP_AAD_DOMAIN = "rcat-cms-totp-secret-v1:";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string, expectedBytes?: number) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError("base64url value is invalid");

  try {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes) throw new Error("size");
    if (encodeBase64Url(bytes) !== value) throw new Error("canonical");
    return bytes;
  } catch {
    throw new TypeError("base64url value is invalid");
  }
}

function encodeBase32(bytes: Uint8Array) {
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
  if (bits > 0) result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

function encryptionConfig(keyValue: unknown, keyVersion: unknown) {
  if (typeof keyValue !== "string" || !KEY_PATTERN.test(keyValue)) {
    throw new TypeError("CMS MFA encryption key is unavailable");
  }
  if (typeof keyVersion !== "string" || !KEY_VERSION_PATTERN.test(keyVersion)) {
    throw new TypeError("CMS MFA encryption key version is unavailable");
  }
  return { keyBytes: decodeBase64Url(keyValue, 32), keyVersion };
}

export function validateMfaEncryptionConfiguration(keyValue: unknown, keyVersion: unknown) {
  encryptionConfig(keyValue, keyVersion);
}

function aad(userId: string, keyVersion: string) {
  if (!userId || userId.length > 256 || !KEY_VERSION_PATTERN.test(keyVersion)) {
    throw new TypeError("CMS MFA encryption context is invalid");
  }
  return textEncoder.encode(`${TOTP_AAD_DOMAIN}${userId}:${keyVersion}`);
}

async function importAesKey(keyBytes: Uint8Array, usages: Array<"decrypt" | "encrypt">) {
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, usages);
}

export async function encryptTotpSecret(input: {
  secret: string;
  userId: string;
  encryptionKey: string | undefined;
  keyVersion: string | undefined;
}) {
  const config = encryptionConfig(input.encryptionKey, input.keyVersion);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(config.keyBytes, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad(input.userId, config.keyVersion), tagLength: 128 },
    key,
    textEncoder.encode(input.secret)
  );
  return {
    encryptedSecret: encodeBase64Url(new Uint8Array(ciphertext)),
    iv: encodeBase64Url(iv),
    keyVersion: config.keyVersion
  };
}

export async function decryptTotpSecret(input: {
  encryptedSecret: string;
  iv: string;
  userId: string;
  storedKeyVersion: string;
  encryptionKey: string | undefined;
  configuredKeyVersion: string | undefined;
}) {
  const config = encryptionConfig(input.encryptionKey, input.configuredKeyVersion);
  if (input.storedKeyVersion !== config.keyVersion) {
    throw new TypeError("CMS MFA encryption key version does not match");
  }
  const key = await importAesKey(config.keyBytes, ["decrypt"]);

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(input.iv, 12),
        additionalData: aad(input.userId, input.storedKeyVersion),
        tagLength: 128
      },
      key,
      decodeBase64Url(input.encryptedSecret)
    );
    const secret = textDecoder.decode(plaintext);
    if (!/^[A-Z2-7]{32}$/.test(secret)) throw new Error("secret");
    return secret;
  } catch {
    throw new TypeError("CMS MFA secret could not be decrypted");
  }
}

export function normalizeRecoveryCode(value: unknown) {
  if (typeof value !== "string") return null;
  const canonical = value.toUpperCase();
  if (!RECOVERY_CODE_PATTERN.test(canonical) && !/^[A-Z2-7]{5}(?:-[A-Z2-7]{5}){4}-[A-Z2-7]$/.test(canonical))
    return null;
  const normalized = canonical.replace(/-/g, "");
  return RECOVERY_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function generateRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const raw = encodeBase32(crypto.getRandomValues(new Uint8Array(16)));
    return raw.match(/.{1,5}/g)?.join("-") ?? raw;
  });
}

export async function hashRecoveryCode(value: unknown) {
  const normalized = normalizeRecoveryCode(value);
  if (!normalized) throw new TypeError("recovery code is invalid");
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(`${RECOVERY_CODE_DOMAIN}${normalized}`));
  return encodeBase64Url(new Uint8Array(digest));
}
