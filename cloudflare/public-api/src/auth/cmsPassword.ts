import bcrypt from "bcryptjs";

export const CMS_PASSWORD_ALGORITHM = "bcrypt-sha384-v1";
export const CMS_PASSWORD_BCRYPT_COST = 12;
export const CMS_PASSWORD_MIN_CODE_POINTS = 12;
export const CMS_PASSWORD_MAX_CODE_POINTS = 128;
export const CMS_PASSWORD_MAX_UTF8_BYTES = 1024;

const CMS_PASSWORD_DOMAIN = "rcat-cms-password-v1:";
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const WHITESPACE_ONLY_PATTERN = /^\s*$/u;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;

export const CMS_PASSWORD_DUMMY_HASH = "$2a$12$fMWtExxyNaP7zrvQvWQ19OCeGPYVFAT9oAIONchO2Bwnwj87xG9MK";

export type CmsPasswordPolicyErrorCode =
  "invalid_type" | "empty" | "whitespace_only" | "too_short" | "too_long" | "too_many_bytes" | "control_character";

export type CmsPasswordPolicyResult =
  | { valid: true }
  | {
      valid: false;
      code: CmsPasswordPolicyErrorCode;
    };

function encodeBase64Url(bytes: Uint8Array) {
  let result = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    result += BASE64URL_ALPHABET[first >> 2];
    result += BASE64URL_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)];

    if (index + 1 < bytes.length) {
      result += BASE64URL_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)];
    }

    if (index + 2 < bytes.length) {
      result += BASE64URL_ALPHABET[third & 63];
    }
  }

  return result;
}

async function preparePasswordForBcrypt(password: string) {
  const passwordBytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-384", passwordBytes);
  return `${CMS_PASSWORD_DOMAIN}${encodeBase64Url(new Uint8Array(digest))}`;
}

function isBcryptHash(value: string) {
  return BCRYPT_HASH_PATTERN.test(value);
}

function hasAsciiControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

export function validateCmsPassword(password: unknown): CmsPasswordPolicyResult {
  if (typeof password !== "string") {
    return { valid: false, code: "invalid_type" };
  }

  if (password.length === 0) {
    return { valid: false, code: "empty" };
  }

  if (WHITESPACE_ONLY_PATTERN.test(password)) {
    return { valid: false, code: "whitespace_only" };
  }

  if (hasAsciiControlCharacter(password)) {
    return { valid: false, code: "control_character" };
  }

  if (new TextEncoder().encode(password).byteLength > CMS_PASSWORD_MAX_UTF8_BYTES) {
    return { valid: false, code: "too_many_bytes" };
  }

  const codePointLength = Array.from(password).length;

  if (codePointLength < CMS_PASSWORD_MIN_CODE_POINTS) {
    return { valid: false, code: "too_short" };
  }

  if (codePointLength > CMS_PASSWORD_MAX_CODE_POINTS) {
    return { valid: false, code: "too_long" };
  }

  return { valid: true };
}

async function hashCmsPasswordWithCost(password: string, cost: number) {
  const preparedPassword = await preparePasswordForBcrypt(password);
  return bcrypt.hash(preparedPassword, cost);
}

export function createCmsPasswordHasher(cost: number) {
  if (!Number.isInteger(cost) || cost < 4 || cost > 31) {
    throw new Error("invalid bcrypt cost");
  }

  return (password: string) => hashCmsPasswordWithCost(password, cost);
}

export function hashCmsPassword(password: string) {
  return hashCmsPasswordWithCost(password, CMS_PASSWORD_BCRYPT_COST);
}

export async function verifyCmsPassword(password: string, storedHash: string, algorithm: string) {
  const supportedCredential = algorithm === CMS_PASSWORD_ALGORITHM && isBcryptHash(storedHash);
  const comparisonHash = supportedCredential ? storedHash : CMS_PASSWORD_DUMMY_HASH;

  try {
    const preparedPassword = await preparePasswordForBcrypt(password);
    const matches = await bcrypt.compare(preparedPassword, comparisonHash);
    return supportedCredential && matches;
  } catch {
    return false;
  }
}

export function performCmsDummyPasswordComparison(password: string) {
  return verifyCmsPassword(password, CMS_PASSWORD_DUMMY_HASH, CMS_PASSWORD_ALGORITHM);
}
