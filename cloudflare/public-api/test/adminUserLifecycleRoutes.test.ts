// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const lifecycleRepository = vi.hoisted(() => ({
  listSafeUserLifecycleStatuses: vi.fn(),
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
  lifecycleRepository.listSafeUserLifecycleStatuses.mockResolvedValue([safeUser]);
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
