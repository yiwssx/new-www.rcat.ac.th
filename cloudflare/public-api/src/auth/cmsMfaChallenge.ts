import { hashCmsClientIp, hashCmsUserAgent } from "./cmsSessionCrypto";

export const CMS_MFA_LOGIN_CHALLENGE_SECONDS = 5 * 60;
export const CMS_MFA_ENROLLMENT_CHALLENGE_SECONDS = 10 * 60;
export const CMS_MFA_CHALLENGE_MAX_FAILURES = 5;
const CHALLENGE_DOMAIN = "rcat-cms-mfa-challenge-v1:";
const textEncoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function isValidMfaChallengeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function generateMfaChallengeToken() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashMfaChallengeToken(value: string) {
  if (!isValidMfaChallengeToken(value)) throw new TypeError("MFA challenge token is invalid");
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(`${CHALLENGE_DOMAIN}${value}`));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function hashMfaChallengeMetadata(clientIp: string, userAgent: string, proxySecret: string) {
  const [ipHash, userAgentHash] = await Promise.all([
    hashCmsClientIp(clientIp, proxySecret),
    hashCmsUserAgent(userAgent, proxySecret)
  ]);
  return { ipHash, userAgentHash };
}

export function getMfaChallengeExpiry(purpose: "login" | "enrollment", now: Date) {
  const duration = purpose === "login" ? CMS_MFA_LOGIN_CHALLENGE_SECONDS : CMS_MFA_ENROLLMENT_CHALLENGE_SECONDS;
  return new Date(now.getTime() + duration * 1000);
}
