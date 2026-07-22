// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const lifecycleRepository = vi.hoisted(() => ({
  readSafeUserLifecycleStatus: vi.fn(),
  readSafeUserLifecycleStatusByEmail: vi.fn(),
  isUsernameAvailable: vi.fn(),
  createUserWithInvitation: vi.fn(),
  issueInvitationForExistingUser: vi.fn(),
  revokePendingInvitations: vi.fn(),
  issuePasswordReset: vi.fn(),
  revokeUserSessions: vi.fn(),
  updateUserWithSecurityRevocation: vi.fn(),
  deleteUserWithAudit: vi.fn()
}));

vi.mock("../src/db/adminUserLifecycleRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/db/adminUserLifecycleRepository")>();
  return { ...actual, createAdminUserLifecycleRepository: () => lifecycleRepository };
});

import worker from "../src/index";
import type { Env } from "../src/env";

const smokeToken = "phase-5-admin-lifecycle-smoke-token";
const safeUser = {
  id: "user-1",
  email: "user@example.test",
  name: "Lifecycle User",
  role: "editor" as const,
  status: "active" as const,
  username: "lifecycle.user",
  isRoot: false,
  mustChangePassword: false,
  mfaRequired: false,
  credentialConfigured: true,
  invitationStatus: "none" as const,
  invitationExpiresAt: null,
  lastLoginAt: "2026-07-20T00:00:00.000Z",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
  revision: 2
};

function db(activeAdminCount = 2) {
  return {
    prepare: vi.fn(() => ({
      bind() {
        return this;
      },
      async all() {
        return {
          results: Array.from({ length: activeAdminCount }, (_, index) => ({ id: `admin-${index}` })),
          success: true,
          meta: {}
        };
      }
    }))
  } as unknown as D1Database;
}

type SqlCall = { bindings: unknown[]; query: string };

function paginatedUsersDb(rows: Array<Record<string, unknown>>, total = rows.length) {
  const calls: SqlCall[] = [];
  const database = {
    prepare(query: string) {
      const call = { query, bindings: [] as unknown[] };
      calls.push(call);
      return {
        bind(...bindings: unknown[]) {
          call.bindings.push(...bindings);
          return this;
        },
        async all() {
          return {
            results: /COUNT\(\*\)\s+AS\s+total/i.test(query) ? [{ total }] : rows,
            success: true,
            meta: {}
          };
        }
      };
    }
  } as unknown as D1Database;
  return { calls, database };
}

function lifecycleListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user@example.test",
    name: "Lifecycle User",
    role: "editor",
    status: "active",
    username: "lifecycle.user",
    is_root: 0,
    must_change_password: 1,
    mfa_required: 0,
    credential_configured: 0,
    invitation_status: "pending",
    invitation_expires_at: "2026-07-25T06:00:00.000Z",
    last_login_at: "",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-22T06:00:00.000Z",
    revision: 2,
    ...overrides
  };
}

function env(database = db()): Env {
  return {
    DB: database,
    ADMIN_WRITE_PREVIEW_ENABLED: "true",
    ADMIN_WRITE_SMOKE_ENABLED: "true",
    ADMIN_WRITE_SMOKE_TOKEN: smokeToken
  };
}

function request(path: string, role: string, init: RequestInit = {}, email = `${role}@example.test`) {
  return new Request(`https://worker.example.test${path}`, {
    ...init,
    headers: {
      "X-RCAT-Admin-Smoke-Token": smokeToken,
      "X-RCAT-Admin-Proxy-Email": email,
      "X-RCAT-Admin-Proxy-Role": role,
      ...init.headers
    }
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  lifecycleRepository.readSafeUserLifecycleStatus.mockImplementation(async (id: string) => ({ ...safeUser, id }));
  lifecycleRepository.readSafeUserLifecycleStatusByEmail.mockResolvedValue(safeUser);
  lifecycleRepository.isUsernameAvailable.mockResolvedValue(true);
  lifecycleRepository.createUserWithInvitation.mockResolvedValue(undefined);
  lifecycleRepository.issueInvitationForExistingUser.mockResolvedValue(undefined);
  lifecycleRepository.revokePendingInvitations.mockResolvedValue(true);
  lifecycleRepository.issuePasswordReset.mockResolvedValue(undefined);
  lifecycleRepository.revokeUserSessions.mockResolvedValue(undefined);
  lifecycleRepository.updateUserWithSecurityRevocation.mockResolvedValue(undefined);
  lifecycleRepository.deleteUserWithAudit.mockResolvedValue(undefined);
});

describe("Admin user lifecycle routes", () => {
  it("returns every safe lifecycle field from the authoritative paginated user list", async () => {
    const state = paginatedUsersDb([
      lifecycleListRow(),
      lifecycleListRow({
        id: "user-2",
        email: "expired@example.test",
        username: null,
        invitation_status: "expired",
        invitation_expires_at: "2026-07-20T06:00:00.000Z"
      }),
      lifecycleListRow({
        id: "user-3",
        email: "configured@example.test",
        must_change_password: 0,
        credential_configured: 1,
        invitation_status: "none",
        invitation_expires_at: null,
        last_login_at: "2026-07-21T06:00:00.000Z"
      })
    ]);
    const response = await worker.fetch(request("/api/admin/users", "admin"), env(state.database));
    const body = await response.text();
    const parsed = JSON.parse(body) as { items: Array<Record<string, unknown>>; pagination: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(parsed.items[0]).toEqual({
      id: "user-1",
      email: "user@example.test",
      name: "Lifecycle User",
      role: "editor",
      status: "active",
      username: "lifecycle.user",
      isRoot: false,
      mustChangePassword: true,
      mfaRequired: false,
      credentialConfigured: false,
      invitationStatus: "pending",
      invitationExpiresAt: "2026-07-25T06:00:00.000Z",
      lastLoginAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-22T06:00:00.000Z",
      revision: 2
    });
    expect(parsed.items[1]).toMatchObject({ invitationStatus: "expired" });
    expect(parsed.items[2]).toMatchObject({
      credentialConfigured: true,
      invitationStatus: "none",
      invitationExpiresAt: null
    });
    expect(parsed.pagination).toMatchObject({ page: 1, pageSize: 25, totalItems: 3, totalPages: 1 });
    expect(body).not.toMatch(
      /passwordHash|passwordAlgorithm|failedLoginCount|lockedUntil|tokenHash|requestIpHash|sessionVersion|sessionToken|csrfToken/i
    );
  });

  it("preserves user-list filtering, sorting, pagination, and one timestamp for invitation classification", async () => {
    const state = paginatedUsersDb([lifecycleListRow()], 5);
    const response = await worker.fetch(
      request(
        "/api/admin/users?q=life&role=editor&status=active&sortBy=updatedAt&sortDirection=desc&page=2&pageSize=2",
        "admin"
      ),
      env(state.database)
    );
    const body = (await json(response)) as {
      generatedAt: string;
      pagination: Record<string, unknown>;
    };
    const countCall = state.calls.find((call) => /COUNT\(\*\)\s+AS\s+total/i.test(call.query));
    const pageCall = state.calls.find((call) => /LIMIT\s+\?\s+OFFSET\s+\?/i.test(call.query));

    expect(response.status).toBe(200);
    expect(body.pagination).toMatchObject({
      page: 2,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true
    });
    expect(countCall?.query).toMatch(/email LIKE \?[^]*name LIKE \?/i);
    expect(countCall?.query).toMatch(/role = \?[^]*status = \?/i);
    expect(countCall?.bindings).toEqual(["%life%", "%life%", "editor", "active"]);
    expect(pageCall?.query).toMatch(/ORDER BY updated_at DESC, id ASC LIMIT \? OFFSET \?/i);
    expect(pageCall?.bindings.slice(0, 3)).toEqual([body.generatedAt, body.generatedAt, body.generatedAt]);
    expect(pageCall?.bindings.slice(3)).toEqual(["%life%", "%life%", "editor", "active", 2, 2]);
  });

  it("creates an active non-Root credentialless user and initial invitation atomically", async () => {
    lifecycleRepository.readSafeUserLifecycleStatus.mockImplementation(async (id: string) => ({
      ...safeUser,
      id,
      credentialConfigured: false,
      mustChangePassword: true,
      invitationStatus: "pending"
    }));
    const response = await worker.fetch(
      request("/api/admin/users", "admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "NEW.USER@example.test",
          name: "New User",
          role: "viewer",
          username: "NEW.USER"
        })
      }),
      env()
    );
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(lifecycleRepository.createUserWithInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          email: "new.user@example.test",
          role: "viewer",
          username: "new.user"
        })
      })
    );
    expect(body.invitation).toMatchObject({ delivery: "manual", token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    expect(JSON.stringify(body)).not.toMatch(/tokenHash|passwordHash|sessionVersion|failedLoginCount|lockedUntil/i);
  });

  it.each(["editor", "viewer"])("denies %s user creation before lifecycle work", async (role) => {
    const response = await worker.fetch(
      request("/api/admin/users", role, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@example.test", name: "New", role: "viewer" })
      }),
      env()
    );
    expect(response.status).toBe(403);
    expect(lifecycleRepository.createUserWithInvitation).not.toHaveBeenCalled();
  });

  it("reissues and revokes invitations", async () => {
    lifecycleRepository.readSafeUserLifecycleStatus.mockResolvedValue({
      ...safeUser,
      credentialConfigured: false,
      mustChangePassword: true,
      invitationStatus: "expired"
    });
    const issued = await worker.fetch(
      request("/api/admin/users/user-1/invitations", "admin", { method: "POST" }),
      env()
    );
    const revoked = await worker.fetch(
      request("/api/admin/users/user-1/invitations", "admin", { method: "DELETE" }),
      env()
    );
    expect(issued.status).toBe(201);
    expect(revoked.status).toBe(200);
    expect(lifecycleRepository.issueInvitationForExistingUser).toHaveBeenCalledOnce();
    expect(lifecycleRepository.revokePendingInvitations).toHaveBeenCalledOnce();
  });

  it("denies Editor invitation issuance and executes no lifecycle method", async () => {
    const response = await worker.fetch(
      request("/api/admin/users/user-1/invitations", "editor", { method: "POST" }),
      env()
    );
    expect(response.status).toBe(403);
    expect(lifecycleRepository.issueInvitationForExistingUser).not.toHaveBeenCalled();
  });

  it("issues a reset only through the Admin route and returns the raw token once", async () => {
    const response = await worker.fetch(
      request("/api/admin/users/user-1/password-reset", "admin", { method: "POST" }),
      env()
    );
    const body = await json(response);
    expect(response.status).toBe(201);
    expect(body.passwordReset).toMatchObject({
      delivery: "manual",
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/)
    });
    expect(lifecycleRepository.issuePasswordReset).toHaveBeenCalledOnce();
  });

  it("denies Editor reset issuance", async () => {
    const response = await worker.fetch(
      request("/api/admin/users/user-1/password-reset", "editor", { method: "POST" }),
      env()
    );
    expect(response.status).toBe(403);
    expect(lifecycleRepository.issuePasswordReset).not.toHaveBeenCalled();
  });

  it("allows Admin Session revocation but denies Editor", async () => {
    const allowed = await worker.fetch(
      request("/api/admin/users/user-1/revoke-sessions", "admin", { method: "POST" }),
      env()
    );
    const denied = await worker.fetch(
      request("/api/admin/users/user-1/revoke-sessions", "editor", { method: "POST" }),
      env()
    );
    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
    expect(lifecycleRepository.revokeUserSessions).toHaveBeenCalledOnce();
  });

  it("prevents an ordinary Admin from revoking Root Sessions and lets Root revoke its own", async () => {
    lifecycleRepository.readSafeUserLifecycleStatus.mockResolvedValue({
      ...safeUser,
      id: "root-1",
      email: "root@example.test",
      role: "admin",
      isRoot: true
    });
    const ordinary = await worker.fetch(
      request("/api/admin/users/root-1/revoke-sessions", "admin", { method: "POST" }, "admin@example.test"),
      env()
    );
    const root = await worker.fetch(
      request("/api/admin/users/root-1/revoke-sessions", "admin", { method: "POST" }, "ROOT@example.test"),
      env()
    );
    expect(ordinary.status).toBe(403);
    expect(root.status).toBe(200);
    expect(lifecycleRepository.revokeUserSessions).toHaveBeenCalledOnce();
  });

  it.each([
    [{ role: "viewer" }, true, false],
    [{ status: "disabled" }, true, true],
    [{ email: "changed@example.test" }, true, true],
    [{ name: "Name Only" }, false, false]
  ] as const)(
    "classifies sensitive update %# and revokes the required state",
    async (patch, sensitive, revokeInvitations) => {
      const response = await worker.fetch(
        request("/api/admin/users/user-1", "admin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        }),
        env()
      );
      expect(response.status).toBe(200);
      expect(lifecycleRepository.updateUserWithSecurityRevocation).toHaveBeenCalledWith(
        expect.objectContaining({ securitySensitive: sensitive, revokeInvitations })
      );
    }
  );

  it("does not restore old Sessions or tokens when re-enabling a user", async () => {
    lifecycleRepository.readSafeUserLifecycleStatus.mockResolvedValue({ ...safeUser, status: "disabled" });
    const response = await worker.fetch(
      request("/api/admin/users/user-1", "admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" })
      }),
      env()
    );
    expect(response.status).toBe(200);
    expect(lifecycleRepository.updateUserWithSecurityRevocation).toHaveBeenCalledWith(
      expect.objectContaining({ securitySensitive: true, revokeInvitations: false })
    );
  });

  it("preserves Root protection and last-active-Admin protection", async () => {
    lifecycleRepository.readSafeUserLifecycleStatus.mockResolvedValue({
      ...safeUser,
      role: "admin",
      isRoot: true,
      email: "root@example.test"
    });
    const root = await worker.fetch(
      request("/api/admin/users/user-1", "admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disabled" })
      }),
      env()
    );
    lifecycleRepository.readSafeUserLifecycleStatus.mockResolvedValue({ ...safeUser, role: "admin", isRoot: false });
    const lastAdmin = await worker.fetch(
      request("/api/admin/users/user-1", "admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "editor" })
      }),
      env(db(1))
    );
    expect(root.status).toBe(403);
    expect(lastAdmin.status).toBe(403);
  });

  it("returns safe lifecycle fields without credential, token, lockout, or Session internals", async () => {
    const response = await worker.fetch(request("/api/admin/users/user-1", "admin"), env());
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(body).item).toMatchObject({
      username: safeUser.username,
      isRoot: false,
      credentialConfigured: true,
      invitationStatus: "none",
      lastLoginAt: safeUser.lastLoginAt
    });
    expect(body).not.toMatch(/passwordHash|passwordAlgorithm|failedLoginCount|lockedUntil|tokenHash|sessionVersion/i);
  });
});
