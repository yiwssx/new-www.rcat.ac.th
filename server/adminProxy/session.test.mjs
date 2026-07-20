// @vitest-environment node

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createAdminProxySessionCookie,
  getAdminProxySessionCookieName,
  verifyAdminProxySessionCookie
} from "./session.mjs";

const SESSION_SECRET = "fake-admin-proxy-session-secret-32-characters";
const EMAIL = "admin@example.test";
const ISSUED_AT_MS = Date.parse("2026-06-19T05:00:00.000Z");
const ISSUED_AT_SECONDS = Math.floor(ISSUED_AT_MS / 1000);
const SESSION_TTL_SECONDS = 7200;

function readCookieValue(cookie) {
  return cookie.split(";", 1)[0].split("=", 2)[1];
}

function readPayload(cookie) {
  const encodedPayload = readCookieValue(cookie).split(".", 1)[0];
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
}

function makeSignedCookie(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${getAdminProxySessionCookieName()}=${encodedPayload}.${signature}`;
}

describe("legacy admin proxy session", () => {
  it("issues an exact two-hour payload and cookie lifetime with existing flags", async () => {
    const cookie = await createAdminProxySessionCookie({
      email: EMAIL,
      role: "admin",
      secret: SESSION_SECRET,
      nowMs: ISSUED_AT_MS
    });
    const payload = readPayload(cookie);

    expect(payload.iat).toBe(ISSUED_AT_SECONDS);
    expect(payload.exp).toBe(ISSUED_AT_SECONDS + SESSION_TTL_SECONDS);
    expect(cookie).toContain("Max-Age=7200");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("is valid one second before expiration and invalid at expiration", async () => {
    const cookie = await createAdminProxySessionCookie({
      email: EMAIL,
      role: "editor",
      secret: SESSION_SECRET,
      nowMs: ISSUED_AT_MS
    });
    const cookieHeader = cookie.split(";", 1)[0];

    await expect(
      verifyAdminProxySessionCookie({
        allowedEmails: [EMAIL],
        cookieHeader,
        nowMs: ISSUED_AT_MS + (SESSION_TTL_SECONDS - 1) * 1000,
        secret: SESSION_SECRET
      })
    ).resolves.toEqual({ email: EMAIL, role: "editor", status: "valid" });
    await expect(
      verifyAdminProxySessionCookie({
        allowedEmails: [EMAIL],
        cookieHeader,
        nowMs: ISSUED_AT_MS + SESSION_TTL_SECONDS * 1000,
        secret: SESSION_SECRET
      })
    ).resolves.toEqual({ email: null, status: "invalid" });
  });

  it("keeps tampered cookies and signed invalid roles invalid", async () => {
    const cookie = await createAdminProxySessionCookie({
      email: EMAIL,
      role: "viewer",
      secret: SESSION_SECRET,
      nowMs: ISSUED_AT_MS
    });
    const tamperedCookie = `${cookie.split(";", 1)[0]}tampered`;
    const invalidRoleCookie = makeSignedCookie({
      email: EMAIL,
      exp: ISSUED_AT_SECONDS + SESSION_TTL_SECONDS,
      iat: ISSUED_AT_SECONDS,
      role: "owner",
      version: 1
    });

    await expect(
      verifyAdminProxySessionCookie({
        allowedEmails: [EMAIL],
        cookieHeader: tamperedCookie,
        nowMs: ISSUED_AT_MS,
        secret: SESSION_SECRET
      })
    ).resolves.toEqual({ email: null, status: "invalid" });
    await expect(
      verifyAdminProxySessionCookie({
        allowedEmails: [EMAIL],
        cookieHeader: invalidRoleCookie,
        nowMs: ISSUED_AT_MS,
        secret: SESSION_SECRET
      })
    ).resolves.toEqual({ email: null, status: "invalid" });
  });

  it("preserves the email allowlist check", async () => {
    const cookie = await createAdminProxySessionCookie({
      email: EMAIL,
      role: "admin",
      secret: SESSION_SECRET,
      nowMs: ISSUED_AT_MS
    });

    await expect(
      verifyAdminProxySessionCookie({
        allowedEmails: ["other@example.test"],
        cookieHeader: cookie.split(";", 1)[0],
        nowMs: ISSUED_AT_MS,
        secret: SESSION_SECRET
      })
    ).resolves.toEqual({ email: EMAIL, status: "forbidden" });
  });
});
