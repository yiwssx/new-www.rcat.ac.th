import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "__Host-rcat_admin_proxy_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MINIMUM_SECRET_LENGTH = 32;
const ADMIN_ROLES = new Set(["admin", "editor", "viewer"]);

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeRole(value) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";

  return ADMIN_ROLES.has(role) ? role : "";
}

function requireSessionSecret(secret) {
  const normalized = typeof secret === "string" ? secret.trim() : "";

  if (normalized.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("admin proxy session secret is not configured");
  }

  return normalized;
}

function signPayload(encodedPayload, secret) {
  return createHmac("sha256", requireSessionSecret(secret)).update(encodedPayload).digest("base64url");
}

function signaturesMatch(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function readCookie(cookieHeader, name) {
  if (typeof cookieHeader !== "string") {
    return "";
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();

    if (key === name) {
      return part.slice(separatorIndex + 1).trim();
    }
  }

  return "";
}

export function getAdminProxySessionCookieName() {
  return COOKIE_NAME;
}

export function getAdminProxyAllowedEmails(value) {
  return [...new Set((typeof value === "string" ? value : "").split(",").map(normalizeEmail).filter(Boolean))];
}

export async function createAdminProxySessionCookie({ email, role = "admin", secret, nowMs = Date.now() }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeRole(role);

  if (!normalizedEmail) {
    throw new Error("admin proxy session email is required");
  }

  if (!normalizedRole) {
    throw new Error("admin proxy session role is required");
  }

  const issuedAt = Math.floor(nowMs / 1000);
  const payload = {
    email: normalizedEmail,
    exp: issuedAt + SESSION_TTL_SECONDS,
    iat: issuedAt,
    role: normalizedRole,
    version: 1
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload, secret);

  return `${COOKIE_NAME}=${encodedPayload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearAdminProxySessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function verifyAdminProxySessionCookie({ allowedEmails, cookieHeader, nowMs = Date.now(), secret }) {
  const value = readCookie(cookieHeader, COOKIE_NAME);

  if (!value) {
    return { email: null, status: "missing" };
  }

  const parts = value.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { email: null, status: "invalid" };
  }

  const [encodedPayload, actualSignature] = parts;

  try {
    const expectedSignature = signPayload(encodedPayload, secret);

    if (!signaturesMatch(actualSignature, expectedSignature)) {
      return { email: null, status: "invalid" };
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const email = normalizeEmail(payload.email);
    const role = normalizeRole(payload.role);
    const nowSeconds = Math.floor(nowMs / 1000);

    if (
      payload.version !== 1 ||
      !role ||
      !email ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= nowSeconds ||
      payload.iat > nowSeconds
    ) {
      return { email: null, status: "invalid" };
    }

    if (!allowedEmails.includes(email)) {
      return { email, status: "forbidden" };
    }

    return { email, role, status: "valid" };
  } catch {
    return { email: null, status: "invalid" };
  }
}
