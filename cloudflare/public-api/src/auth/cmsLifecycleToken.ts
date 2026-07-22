const LIFECYCLE_TOKEN_BYTES = 32;
const LIFECYCLE_TOKEN_LENGTH = 43;
const LIFECYCLE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const INVITATION_DOMAIN = "rcat-cms-invitation-token-v1:";
const PASSWORD_RESET_DOMAIN = "rcat-cms-password-reset-token-v1:";

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateLifecycleToken() {
  const bytes = new Uint8Array(LIFECYCLE_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const token = encodeBase64Url(bytes);

  if (token.length !== LIFECYCLE_TOKEN_LENGTH) {
    throw new Error("lifecycle token generation failed");
  }

  return token;
}

async function hashLifecycleToken(token: unknown, domain: string) {
  if (!isValidLifecycleToken(token)) {
    throw new TypeError("invalid lifecycle token");
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${domain}${token}`));
  return encodeBase64Url(new Uint8Array(digest));
}

export function isValidLifecycleToken(value: unknown): value is string {
  return typeof value === "string" && value.length === LIFECYCLE_TOKEN_LENGTH && LIFECYCLE_TOKEN_PATTERN.test(value);
}

export function generateInvitationToken() {
  return generateLifecycleToken();
}

export function hashInvitationToken(token: unknown) {
  return hashLifecycleToken(token, INVITATION_DOMAIN);
}

export function generatePasswordResetToken() {
  return generateLifecycleToken();
}

export function hashPasswordResetToken(token: unknown) {
  return hashLifecycleToken(token, PASSWORD_RESET_DOMAIN);
}
