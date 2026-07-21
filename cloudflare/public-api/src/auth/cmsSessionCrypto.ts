const CMS_TOKEN_BYTES = 32;
const CMS_TOKEN_LENGTH = 43;
const CMS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_TOKEN_DOMAIN = "rcat-cms-session-token-v1:";
const CSRF_TOKEN_DOMAIN = "rcat-cms-csrf-token-v1:";
const CLIENT_IP_DOMAIN = "rcat-cms-client-ip-v1:";
const USER_AGENT_DOMAIN = "rcat-cms-user-agent-v1:";

const textEncoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  if (!CMS_TOKEN_PATTERN.test(value)) {
    return null;
  }

  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=";
    const binary = atob(padded);

    if (binary.length !== CMS_TOKEN_BYTES) {
      return null;
    }

    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function requireCmsToken(token: string) {
  if (!isValidCmsToken(token)) {
    throw new TypeError("invalid CMS token");
  }

  return token;
}

async function hashDomainValue(domain: string, value: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(`${domain}${value}`));
  return encodeBase64Url(new Uint8Array(digest));
}

async function hmacDomainValue(domain: string, value: string, secret: string) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError("CMS authentication is unavailable");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(`${domain}${value}`));
  return encodeBase64Url(new Uint8Array(signature));
}

export function isValidCmsToken(value: unknown): value is string {
  return typeof value === "string" && value.length === CMS_TOKEN_LENGTH && decodeBase64Url(value) !== null;
}

export function generateCmsToken() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(CMS_TOKEN_BYTES)));
}

export function generateCmsSessionToken() {
  return generateCmsToken();
}

export function generateCmsCsrfToken() {
  return generateCmsToken();
}

export function hashCmsSessionToken(token: string) {
  return hashDomainValue(SESSION_TOKEN_DOMAIN, requireCmsToken(token));
}

export function hashCmsCsrfToken(token: string) {
  return hashDomainValue(CSRF_TOKEN_DOMAIN, requireCmsToken(token));
}

export function hashCmsClientIp(ip: string, secret: string) {
  return hmacDomainValue(CLIENT_IP_DOMAIN, ip, secret);
}

export function hashCmsUserAgent(userAgent: string, secret: string) {
  return hmacDomainValue(USER_AGENT_DOMAIN, userAgent, secret);
}

export function fixedSizeBytesEqual(actual: Uint8Array, expected: Uint8Array) {
  if (actual.byteLength !== expected.byteLength) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < actual.byteLength; index += 1) {
    difference |= actual[index] ^ expected[index];
  }

  return difference === 0;
}

export function fixedSizeBase64UrlEqual(actual: string, expected: string) {
  const actualBytes = decodeBase64Url(actual);
  const expectedBytes = decodeBase64Url(expected);

  return actualBytes !== null && expectedBytes !== null && fixedSizeBytesEqual(actualBytes, expectedBytes);
}

export async function constantTimeTextEqual(actual: string, expected: string) {
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(actual)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(expected))
  ]);

  return fixedSizeBytesEqual(new Uint8Array(actualDigest), new Uint8Array(expectedDigest));
}
