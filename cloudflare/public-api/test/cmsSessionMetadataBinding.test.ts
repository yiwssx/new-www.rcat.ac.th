// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  CMS_SESSION_ABSOLUTE_SECONDS,
  CMS_SESSION_IDLE_SECONDS,
  authenticateCmsSession
} from "../src/auth/cmsSessionService";
import { hashCmsClientIp, hashCmsCsrfToken, hashCmsSessionToken, hashCmsUserAgent } from "../src/auth/cmsSessionCrypto";
import type { AdminSessionRepository, AdminSessionWithUser } from "../src/db/adminSessionRepository";
import type { AdminAuthUserRow } from "../src/db/schema";

const fixedNow = new Date("2026-09-06T13:53:55.000Z");
const sessionToken = "A".repeat(43);
const csrfToken = "B".repeat(43);
const testSecret = "test-only-cms-proxy-secret-repeated-000000000000";
const originalIp = "192.0.2.10";
const changedIp = "198.51.100.25";
const userAgent = "phase-c3-browser/1.0";

const user: AdminAuthUserRow = {
  id: "admin-user-phase-c3",
  email: "phase-c3@example.invalid",
  name: "Phase C3 Editor",
  username: "phase.c3.editor",
  role: "editor",
  status: "active",
  created_at: fixedNow.toISOString(),
  updated_at: fixedNow.toISOString(),
  created_by: "fixture",
  updated_by: "fixture",
  revision: 0,
  is_root: 0,
  must_change_password: 0,
  mfa_required: 0,
  session_version: 1,
  last_login_at: fixedNow.toISOString()
};

async function makeRecord(): Promise<AdminSessionWithUser> {
  return {
    session: {
      id: "admin-session-phase-c3",
      user_id: user.id,
      token_hash: await hashCmsSessionToken(sessionToken),
      csrf_token_hash: await hashCmsCsrfToken(csrfToken),
      created_at: fixedNow.toISOString(),
      last_seen_at: fixedNow.toISOString(),
      idle_expires_at: new Date(fixedNow.getTime() + CMS_SESSION_IDLE_SECONDS * 1000).toISOString(),
      absolute_expires_at: new Date(fixedNow.getTime() + CMS_SESSION_ABSOLUTE_SECONDS * 1000).toISOString(),
      session_version: user.session_version,
      revoked_at: "",
      ip_hash: await hashCmsClientIp(originalIp, testSecret),
      user_agent_hash: await hashCmsUserAgent(userAgent, testSecret),
      reauthenticated_at: fixedNow.toISOString(),
      mfa_verified_at: ""
    },
    user,
    effectiveMfa: false
  };
}

function makeRepository(record: AdminSessionWithUser): AdminSessionRepository {
  return {
    createSession: vi.fn().mockResolvedValue(undefined),
    findSessionByTokenHash: vi.fn().mockResolvedValue(record),
    touchSession: vi.fn().mockResolvedValue(true),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
    updateLastLoginAt: vi.fn().mockResolvedValue(undefined),
    writeSessionSecurityAuditEntry: vi.fn().mockResolvedValue(undefined)
  };
}

describe("CMS session client metadata binding", () => {
  it("keeps a valid session across a legitimate client IP change", async () => {
    const repository = makeRepository(await makeRecord());

    await expect(
      authenticateCmsSession({
        env: { CMS_AUTH_PROXY_SECRET: testSecret },
        sessionToken,
        clientIp: changedIp,
        userAgent,
        method: "GET",
        now: new Date(fixedNow.getTime() + 5_000),
        repository
      })
    ).resolves.toMatchObject({
      status: "authenticated",
      identity: { id: user.id, role: "editor", sessionId: "admin-session-phase-c3" }
    });
  });

  it("still fails closed when the bound User-Agent changes", async () => {
    const repository = makeRepository(await makeRecord());

    await expect(
      authenticateCmsSession({
        env: { CMS_AUTH_PROXY_SECRET: testSecret },
        sessionToken,
        clientIp: originalIp,
        userAgent: "different-browser/2.0",
        method: "GET",
        now: new Date(fixedNow.getTime() + 5_000),
        repository
      })
    ).resolves.toEqual({ status: "unauthenticated" });
  });

  it("requires complete proxy metadata when either metadata field is present", async () => {
    const repository = makeRepository(await makeRecord());

    await expect(
      authenticateCmsSession({
        env: { CMS_AUTH_PROXY_SECRET: testSecret },
        sessionToken,
        userAgent,
        method: "GET",
        now: new Date(fixedNow.getTime() + 5_000),
        repository
      })
    ).resolves.toEqual({ status: "unauthenticated" });
  });
});
