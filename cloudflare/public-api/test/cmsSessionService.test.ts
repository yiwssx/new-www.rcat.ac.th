// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  CMS_SESSION_ABSOLUTE_SECONDS,
  CMS_SESSION_IDLE_SECONDS,
  CMS_SESSION_TOUCH_INTERVAL_SECONDS,
  CmsSessionEligibilityError,
  authenticateCmsSession,
  createCmsSession,
  revokeAllCmsSessions,
  revokeCmsSession
} from "../src/auth/cmsSessionService";
import { hashCmsCsrfToken, hashCmsSessionToken } from "../src/auth/cmsSessionCrypto";
import {
  createAdminSessionRepository,
  type AdminSessionRepository,
  type AdminSessionWithUser
} from "../src/db/adminSessionRepository";
import type { CmsAuthenticatedIdentity } from "../src/auth/cmsCredentialService";
import type { AdminAuthUserRow, AdminSessionRow } from "../src/db/schema";

const fixedNow = new Date("2026-07-22T03:00:00.000Z");
const sessionToken = "A".repeat(43);
const csrfToken = "B".repeat(43);
const testSecret = "test-only-cms-proxy-secret-repeated-000000000000";

const credentialIdentity: CmsAuthenticatedIdentity = {
  id: "admin-user-1",
  email: "admin@example.invalid",
  name: "Admin User",
  username: "admin.user",
  role: "admin",
  isRoot: true,
  mustChangePassword: false,
  mfaRequired: false,
  sessionVersion: 3
};

const user: AdminAuthUserRow = {
  id: credentialIdentity.id,
  email: credentialIdentity.email,
  name: credentialIdentity.name,
  username: credentialIdentity.username,
  role: "admin",
  status: "active",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  created_by: "fixture",
  updated_by: "fixture",
  revision: 0,
  is_root: 1,
  must_change_password: 0,
  mfa_required: 0,
  session_version: 3,
  last_login_at: ""
};

function makeRepository(record: AdminSessionWithUser | null = null): AdminSessionRepository {
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

async function makeRecord(
  options: {
    session?: Partial<AdminSessionRow>;
    user?: Partial<AdminAuthUserRow>;
  } = {}
): Promise<AdminSessionWithUser> {
  const session: AdminSessionRow = {
    id: "admin-session-1",
    user_id: user.id,
    token_hash: await hashCmsSessionToken(sessionToken),
    csrf_token_hash: await hashCmsCsrfToken(csrfToken),
    created_at: fixedNow.toISOString(),
    last_seen_at: fixedNow.toISOString(),
    idle_expires_at: new Date(fixedNow.getTime() + CMS_SESSION_IDLE_SECONDS * 1000).toISOString(),
    absolute_expires_at: new Date(fixedNow.getTime() + CMS_SESSION_ABSOLUTE_SECONDS * 1000).toISOString(),
    session_version: user.session_version,
    revoked_at: "",
    ip_hash: "C".repeat(43),
    user_agent_hash: "D".repeat(43),
    ...options.session
  };

  return { session, user: { ...user, ...options.user } };
}

function createInput(repository: AdminSessionRepository, identity = credentialIdentity) {
  return {
    env: { CMS_AUTH_PROXY_SECRET: testSecret },
    identity,
    clientIp: "192.0.2.10",
    userAgent: "test-browser/1.0",
    now: fixedNow,
    repository,
    generateSessionToken: () => sessionToken,
    generateCsrfToken: () => csrfToken
  };
}

describe("CMS session service", () => {
  it("creates one opaque Session with hashes, copied version, HMAC metadata, and exact expirations", async () => {
    const repository = makeRepository();
    const result = await createCmsSession(createInput(repository));
    const stored = vi.mocked(repository.createSession).mock.calls[0][0];

    expect(repository.createSession).toHaveBeenCalledOnce();
    expect(result.sessionToken).toBe(sessionToken);
    expect(result.csrfToken).toBe(csrfToken);
    expect(stored.session.token_hash).not.toBe(sessionToken);
    expect(stored.session.csrf_token_hash).not.toBe(csrfToken);
    expect(stored.session.ip_hash).not.toContain("192.0.2.10");
    expect(stored.session.user_agent_hash).not.toContain("test-browser/1.0");
    expect(stored.session.session_version).toBe(3);
    expect(Date.parse(stored.session.idle_expires_at) - fixedNow.getTime()).toBe(CMS_SESSION_IDLE_SECONDS * 1000);
    expect(Date.parse(stored.session.absolute_expires_at) - fixedNow.getTime()).toBe(
      CMS_SESSION_ABSOLUTE_SECONDS * 1000
    );
    expect(result.identity).toMatchObject({ role: "admin", sessionVersion: 3 });
    expect(JSON.stringify(result.identity)).not.toMatch(/token|hash|ipHash|userAgentHash/i);
  });

  it.each([
    ["password change", { mustChangePassword: true }],
    ["MFA", { mfaRequired: true }],
    ["invalid role", { role: "invalid" }],
    ["invalid Session version", { sessionVersion: 0 }]
  ])("blocks Session creation for %s eligibility", async (_label, override) => {
    const repository = makeRepository();
    const identity = { ...credentialIdentity, ...override } as CmsAuthenticatedIdentity;

    await expect(createCmsSession(createInput(repository, identity))).rejects.toBeInstanceOf(
      CmsSessionEligibilityError
    );
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it("authenticates a valid Session and loads the current D1 role", async () => {
    const repository = makeRepository(await makeRecord({ user: { role: "editor" } }));
    const result = await authenticateCmsSession({
      env: {},
      sessionToken,
      method: "GET",
      now: new Date(fixedNow.getTime() + 60_000),
      repository
    });

    expect(result).toMatchObject({
      status: "authenticated",
      identity: { role: "editor", sessionId: "admin-session-1" }
    });
  });

  it.each([
    ["revoked", { session: { revoked_at: fixedNow.toISOString() } }],
    ["idle-expired", { session: { idle_expires_at: fixedNow.toISOString() } }],
    ["absolute-expired", { session: { absolute_expires_at: fixedNow.toISOString() } }],
    ["version mismatch", { session: { session_version: 2 } }],
    ["disabled user", { user: { status: "disabled" } }],
    ["invalid role", { user: { role: "invalid" } }],
    ["password change", { user: { must_change_password: 1 } }],
    ["MFA required", { user: { mfa_required: 1 } }],
    ["malformed timestamp", { session: { idle_expires_at: "not-a-time" } }]
  ])("fails closed for a %s Session", async (_label, overrides) => {
    const repository = makeRepository(
      await makeRecord(overrides as { session?: Partial<AdminSessionRow>; user?: Partial<AdminAuthUserRow> })
    );
    const result = await authenticateCmsSession({ env: {}, sessionToken, method: "GET", now: fixedNow, repository });

    expect(result).toEqual({ status: "unauthenticated" });
  });

  it("treats exact idle and absolute expiration boundaries as invalid", async () => {
    const idleBoundary = new Date(fixedNow.getTime() + 60_000);
    const idleRepository = makeRepository(
      await makeRecord({ session: { idle_expires_at: idleBoundary.toISOString() } })
    );
    const absoluteRepository = makeRepository(
      await makeRecord({ session: { absolute_expires_at: idleBoundary.toISOString() } })
    );

    await expect(
      authenticateCmsSession({ env: {}, sessionToken, method: "GET", now: idleBoundary, repository: idleRepository })
    ).resolves.toEqual({ status: "unauthenticated" });
    await expect(
      authenticateCmsSession({
        env: {},
        sessionToken,
        method: "GET",
        now: idleBoundary,
        repository: absoluteRepository
      })
    ).resolves.toEqual({ status: "unauthenticated" });
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"])("requires and validates CSRF for %s", async (method) => {
    const record = await makeRecord();
    const missingRepository = makeRepository(record);
    const wrongRepository = makeRepository(record);
    const correctRepository = makeRepository(record);

    await expect(
      authenticateCmsSession({ env: {}, sessionToken, method, now: fixedNow, repository: missingRepository })
    ).resolves.toEqual({ status: "forbidden" });
    await expect(
      authenticateCmsSession({
        env: {},
        sessionToken,
        csrfToken: "C".repeat(43),
        method,
        now: fixedNow,
        repository: wrongRepository
      })
    ).resolves.toEqual({ status: "forbidden" });
    await expect(
      authenticateCmsSession({ env: {}, sessionToken, csrfToken, method, now: fixedNow, repository: correctRepository })
    ).resolves.toMatchObject({ status: "authenticated" });
  });

  it.each(["GET", "HEAD", "OPTIONS"])("does not require CSRF for %s", async (method) => {
    const repository = makeRepository(await makeRecord());
    await expect(
      authenticateCmsSession({ env: {}, sessionToken, method, now: fixedNow, repository })
    ).resolves.toMatchObject({ status: "authenticated" });
  });

  it("touches only at the five-minute threshold and caps idle extension at absolute expiration", async () => {
    const beforeThreshold = makeRepository(
      await makeRecord({
        session: {
          last_seen_at: new Date(fixedNow.getTime() - CMS_SESSION_TOUCH_INTERVAL_SECONDS * 1000 + 1).toISOString()
        }
      })
    );
    const absoluteSoon = new Date(fixedNow.getTime() + 60_000).toISOString();
    const atThreshold = makeRepository(
      await makeRecord({
        session: {
          last_seen_at: new Date(fixedNow.getTime() - CMS_SESSION_TOUCH_INTERVAL_SECONDS * 1000).toISOString(),
          absolute_expires_at: absoluteSoon
        }
      })
    );

    await authenticateCmsSession({ env: {}, sessionToken, method: "GET", now: fixedNow, repository: beforeThreshold });
    await authenticateCmsSession({ env: {}, sessionToken, method: "GET", now: fixedNow, repository: atThreshold });

    expect(beforeThreshold.touchSession).not.toHaveBeenCalled();
    expect(atThreshold.touchSession).toHaveBeenCalledWith(
      expect.objectContaining({ idleExpiresAt: absoluteSoon, lastSeenAt: fixedNow.toISOString() })
    );
  });

  it("revokes the current Session and logout-all revokes every user Session", async () => {
    const repository = makeRepository(await makeRecord());

    await expect(
      revokeCmsSession({ env: {}, sessionToken, csrfToken, now: fixedNow, repository })
    ).resolves.toMatchObject({ status: "authenticated" });
    await expect(
      revokeAllCmsSessions({ env: {}, sessionToken, csrfToken, now: fixedNow, repository })
    ).resolves.toMatchObject({ status: "authenticated" });
    expect(repository.revokeSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "admin-session-1", userId: user.id })
    );
    expect(repository.revokeAllUserSessions).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id }));
  });

  it("uses one realistic D1 batch for Session creation, last Login, and safe audit metadata", async () => {
    const prepared: Array<{ query: string; bindings: unknown[] }> = [];
    const batch = vi.fn().mockResolvedValue([]);
    const db = {
      prepare(query: string) {
        return {
          query,
          bindings: [] as unknown[],
          bind(...bindings: unknown[]) {
            this.bindings = bindings;
            prepared.push(this);
            return this;
          }
        };
      },
      batch
    } as unknown as D1Database;
    const repository = createAdminSessionRepository({ DB: db });
    const created = await createCmsSession(createInput(repository));

    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0][0]).toHaveLength(3);
    expect(prepared.map((statement) => statement.query)).toEqual([
      expect.stringMatching(/INSERT INTO admin_sessions/i),
      expect.stringMatching(/UPDATE app_admin_users[\s\S]+last_login_at/i),
      expect.stringMatching(/INSERT INTO admin_audit_log/i)
    ]);
    const auditBindings = JSON.stringify(prepared[2].bindings);
    expect(auditBindings).toContain("session.login");
    expect(auditBindings).toContain('\\"authentication\\":\\"password\\"');
    expect(auditBindings).not.toContain(created.sessionToken);
    expect(auditBindings).not.toContain(created.csrfToken);
    expect(auditBindings).not.toContain(prepared[0].bindings[4]);
    expect(auditBindings).not.toMatch(/192\.0\.2\.10|test-browser/);
  });

  it("implements atomic conditional touch and atomic logout-all version increment, revocation, and audit", async () => {
    const prepared: Array<{ query: string; bindings: unknown[]; run: ReturnType<typeof vi.fn> }> = [];
    const batch = vi.fn().mockResolvedValue([]);
    const db = {
      prepare(query: string) {
        const statement = {
          query,
          bindings: [] as unknown[],
          bind(...bindings: unknown[]) {
            this.bindings = bindings;
            prepared.push(this);
            return this;
          },
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
        };
        return statement;
      },
      batch
    } as unknown as D1Database;
    const repository = createAdminSessionRepository({ DB: db });

    await repository.touchSession({
      sessionId: "session-1",
      previousLastSeenAtOrBefore: "2026-07-22T02:55:00.000Z",
      lastSeenAt: fixedNow.toISOString(),
      idleExpiresAt: "2026-07-22T03:30:00.000Z"
    });
    await repository.revokeAllUserSessions({ userId: user.id, actor: user.email, now: fixedNow.toISOString() });

    expect(prepared[0].query).toMatch(/last_seen_at <= \?[\s\S]+absolute_expires_at > \?/i);
    expect(batch).toHaveBeenCalledOnce();
    expect(prepared.slice(1).map((statement) => statement.query)).toEqual([
      expect.stringMatching(/session_version = session_version \+ 1/i),
      expect.stringMatching(/UPDATE admin_sessions[\s\S]+revoked_at/i),
      expect.stringMatching(/INSERT INTO admin_audit_log/i)
    ]);
    expect(prepared[3].bindings).toContain("session.logout_all");
  });
});
