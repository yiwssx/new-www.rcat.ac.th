// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authenticateCmsSession } from "../src/auth/cmsSessionService";
import { hashCmsCsrfToken, hashCmsSessionToken } from "../src/auth/cmsSessionCrypto";
import type { AdminSessionRepository, AdminSessionWithUser } from "../src/db/adminSessionRepository";
import type { AdminAuthUserRow, AdminSessionRow } from "../src/db/schema";

const now = new Date("2026-09-07T09:40:00.000Z");
const sessionToken = "A".repeat(43);
const csrfToken = "B".repeat(43);

async function makeRecord(): Promise<AdminSessionWithUser> {
  const user: AdminAuthUserRow = {
    id: "phase-c3-editor",
    email: "phase-c3@example.invalid",
    name: "Phase C3 Editor",
    username: "phase-c3-editor",
    role: "editor",
    status: "active",
    created_at: "2026-09-07T09:39:00.000Z",
    updated_at: "2026-09-07T09:39:00.000Z",
    created_by: "fixture",
    updated_by: "fixture",
    revision: 0,
    is_root: 0,
    must_change_password: 0,
    mfa_required: 0,
    session_version: 1,
    last_login_at: "2026-09-07T09:39:00.000Z"
  };
  const session: AdminSessionRow = {
    id: "phase-c3-session",
    user_id: user.id,
    token_hash: await hashCmsSessionToken(sessionToken),
    csrf_token_hash: await hashCmsCsrfToken(csrfToken),
    created_at: "2026-09-07T09:39:00.000Z",
    last_seen_at: "2026-09-07T09:39:00.000Z",
    idle_expires_at: "2026-09-07T10:09:00.000Z",
    absolute_expires_at: "2026-09-07T17:39:00.000Z",
    session_version: 1,
    revoked_at: "",
    ip_hash: "C".repeat(43),
    user_agent_hash: "D".repeat(43),
    reauthenticated_at: "2026-09-07T09:39:00.000Z",
    mfa_verified_at: ""
  };

  return { session, user, effectiveMfa: false };
}

function makeRepository(findSessionByTokenHash: AdminSessionRepository["findSessionByTokenHash"]): AdminSessionRepository {
  return {
    createSession: vi.fn().mockResolvedValue(undefined),
    findSessionByTokenHash,
    touchSession: vi.fn().mockResolvedValue(true),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
    updateLastLoginAt: vi.fn().mockResolvedValue(undefined),
    writeSessionSecurityAuditEntry: vi.fn().mockResolvedValue(undefined)
  };
}

describe("CMS mutation Session lookup confirmation", () => {
  it("confirms one transient missing Session row before authorizing a mutation", async () => {
    const record = await makeRecord();
    const findSessionByTokenHash = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(record);
    const repository = makeRepository(findSessionByTokenHash);

    await expect(
      authenticateCmsSession({ env: {}, sessionToken, csrfToken, method: "POST", now, repository })
    ).resolves.toMatchObject({ status: "authenticated", identity: { id: "phase-c3-editor" } });

    expect(findSessionByTokenHash).toHaveBeenCalledTimes(2);
    expect(repository.touchSession).not.toHaveBeenCalled();
  });

  it("fails closed after one confirmation when the Session row remains missing", async () => {
    const findSessionByTokenHash = vi.fn().mockResolvedValue(null);
    const repository = makeRepository(findSessionByTokenHash);

    await expect(
      authenticateCmsSession({ env: {}, sessionToken, csrfToken, method: "POST", now, repository })
    ).resolves.toEqual({ status: "unauthenticated" });

    expect(findSessionByTokenHash).toHaveBeenCalledTimes(2);
    expect(repository.touchSession).not.toHaveBeenCalled();
  });

  it("does not add lookup confirmation to ordinary authorization reads", async () => {
    const findSessionByTokenHash = vi.fn().mockResolvedValue(null);
    const repository = makeRepository(findSessionByTokenHash);

    await expect(authenticateCmsSession({ env: {}, sessionToken, method: "GET", now, repository })).resolves.toEqual({
      status: "unauthenticated"
    });

    expect(findSessionByTokenHash).toHaveBeenCalledOnce();
  });

  it("does not spend a confirmation read on a mutation without a structurally valid CSRF token", async () => {
    const findSessionByTokenHash = vi.fn().mockResolvedValue(null);
    const repository = makeRepository(findSessionByTokenHash);

    await expect(authenticateCmsSession({ env: {}, sessionToken, method: "POST", now, repository })).resolves.toEqual({
      status: "unauthenticated"
    });

    expect(findSessionByTokenHash).toHaveBeenCalledOnce();
  });
});
