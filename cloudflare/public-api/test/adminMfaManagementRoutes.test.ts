// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateCmsSessionMock = vi.hoisted(() => vi.fn());
const mfaRepositoryMock = vi.hoisted(() => ({
  getUserState: vi.fn(),
  resetMfaFactor: vi.fn(),
  setMfaRequirement: vi.fn()
}));
const lifecycleRepositoryMock = vi.hoisted(() => ({
  getCredentialByUserId: vi.fn(),
  readSafeUserLifecycleStatus: vi.fn()
}));

vi.mock("../src/auth/cmsSessionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth/cmsSessionService")>();
  return { ...actual, authenticateCmsSession: authenticateCmsSessionMock };
});

vi.mock("../src/db/adminMfaRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/db/adminMfaRepository")>();
  return { ...actual, createAdminMfaRepository: () => mfaRepositoryMock };
});

vi.mock("../src/db/adminUserLifecycleRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/db/adminUserLifecycleRepository")>();
  return { ...actual, createAdminUserLifecycleRepository: () => lifecycleRepositoryMock };
});

import { ADMIN_CAPABILITIES, getCapabilitiesForRole } from "../src/auth/adminCapabilities";
import { resolveAdminRoutePolicy } from "../src/auth/adminRoutePolicy";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER
} from "../src/routes/cmsAuthInternal";
import worker from "../src/index";

const proxySecret = "test-cms-proxy-secret-repeated-000000000000";

function rootRow() {
  return {
    id: "root-1",
    email: "root@example.invalid",
    name: "Root",
    username: "root",
    role: "admin",
    status: "active",
    revision: 4,
    isRoot: true,
    mfaRequired: true,
    mfaConfigured: true,
    recoveryCodesRemaining: 10,
    credentialConfigured: true,
    invitation: null,
    updatedAt: "2026-07-23T03:00:00.000Z"
  };
}

function request(path: string, method: string, body?: Record<string, unknown>) {
  return new Request(`https://worker.invalid${path}`, {
    method,
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret,
      [CMS_SESSION_TOKEN_HEADER]: "A".repeat(43),
      [CMS_CSRF_TOKEN_HEADER]: "B".repeat(43),
      "Content-Type": "application/json"
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

function env() {
  return {
    CMS_AUTH_ENABLED: "true",
    CMS_AUTH_PROXY_SECRET: proxySecret,
    DB: {
      prepare: vi.fn(() => ({
        bind() {
          return this;
        },
        first: vi.fn(async () => ({ is_root: 1 }))
      }))
    } as unknown as D1Database
  };
}

function authenticatedAdmin(input: { email?: string; isRoot?: boolean; userId?: string } = {}) {
  const assurance = new Date().toISOString();
  return {
    status: "authenticated" as const,
    identity: {
      id: input.userId ?? "admin-1",
      email: input.email ?? "admin@example.invalid",
      name: "Admin",
      username: "admin",
      role: "admin" as const,
      isRoot: input.isRoot ?? false,
      sessionId: "session-1",
      sessionVersion: 1,
      reauthenticatedAt: assurance,
      mfaVerifiedAt: assurance
    }
  };
}

beforeEach(() => {
  authenticateCmsSessionMock.mockReset();
  mfaRepositoryMock.getUserState.mockReset();
  mfaRepositoryMock.resetMfaFactor.mockReset();
  mfaRepositoryMock.setMfaRequirement.mockReset();
  lifecycleRepositoryMock.getCredentialByUserId.mockReset();
  lifecycleRepositoryMock.readSafeUserLifecycleStatus.mockReset();
  lifecycleRepositoryMock.readSafeUserLifecycleStatus.mockResolvedValue(rootRow());
  mfaRepositoryMock.getUserState.mockResolvedValue({
    user: {
      id: "root-1",
      is_root: 1,
      mfa_required: 1
    },
    factor: { state: "enabled" },
    recoveryCodesRemaining: 10
  });
});

describe("admin MFA management route policy", () => {
  it("adds exactly four Phase 6 capabilities with only MFA administration restricted to admins", () => {
    expect(ADMIN_CAPABILITIES).toHaveLength(45);
    expect(getCapabilitiesForRole("admin")).toEqual(
      expect.arrayContaining([
        "auth.reauthenticate-self",
        "auth.mfa.manage-self",
        "users.mfa.require",
        "users.mfa.reset"
      ])
    );
    expect(getCapabilitiesForRole("editor")).toEqual(
      expect.arrayContaining(["auth.reauthenticate-self", "auth.mfa.manage-self"])
    );
    expect(getCapabilitiesForRole("viewer")).not.toContain("users.mfa.reset");
  });

  it("maps exact MFA requirement and reset methods and rejects neighboring methods", () => {
    expect(resolveAdminRoutePolicy("POST", ["users", "user-1", "mfa-requirement"])).toMatchObject({
      matched: true,
      capability: "users.mfa.require"
    });
    expect(resolveAdminRoutePolicy("DELETE", ["users", "user-1", "mfa"])).toMatchObject({
      matched: true,
      capability: "users.mfa.reset"
    });
    expect(resolveAdminRoutePolicy("GET", ["users", "user-1", "mfa"])).toEqual({ matched: false });
  });

  it("executes Root reset ownership protection in the admin handler", async () => {
    authenticateCmsSessionMock.mockResolvedValue(authenticatedAdmin());
    const response = await worker.fetch(request("/api/admin/users/root-1/mfa", "DELETE"), env());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "only Root may reset the Root MFA factor" });
    expect(mfaRepositoryMock.getUserState).toHaveBeenCalledWith("root-1");
    expect(mfaRepositoryMock.resetMfaFactor).not.toHaveBeenCalled();
    expect(lifecycleRepositoryMock.getCredentialByUserId).not.toHaveBeenCalled();
  });

  it("invokes the MFA requirement repository from the admin handler", async () => {
    const target = {
      ...rootRow(),
      id: "viewer-1",
      email: "viewer@example.invalid",
      role: "viewer",
      isRoot: false,
      mfaRequired: false,
      mfaConfigured: false,
      recoveryCodesRemaining: 0
    };
    authenticateCmsSessionMock.mockResolvedValue(authenticatedAdmin());
    lifecycleRepositoryMock.readSafeUserLifecycleStatus.mockResolvedValue(target);
    const response = await worker.fetch(
      request("/api/admin/users/viewer-1/mfa-requirement", "POST", {
        required: true,
        expectedRevision: 4
      }),
      env()
    );

    expect(response.status).toBe(200);
    expect(mfaRepositoryMock.setMfaRequirement).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "viewer-1",
        required: true,
        expectedRevision: 4,
        actor: "admin@example.invalid"
      })
    );
  });

  it("executes Root password/factor proof protection and refuses to disable the Root requirement", async () => {
    authenticateCmsSessionMock.mockResolvedValue(
      authenticatedAdmin({ email: "root@example.invalid", isRoot: true, userId: "root-1" })
    );
    lifecycleRepositoryMock.getCredentialByUserId.mockResolvedValue({
      user_id: "root-1",
      password_hash: "$2b$12$invalid-but-nonempty-hash",
      password_algorithm: "bcrypt"
    });
    const reset = await worker.fetch(
      request("/api/admin/users/root-1/mfa", "DELETE", {
        currentPassword: "wrong password",
        totpCode: "000000"
      }),
      env()
    );
    const requirement = await worker.fetch(
      request("/api/admin/users/root-1/mfa-requirement", "POST", {
        required: false,
        expectedRevision: 4
      }),
      env()
    );

    expect(reset.status).toBe(401);
    expect(await reset.json()).toMatchObject({ error: "MFA reset verification failed" });
    expect(requirement.status).toBe(403);
    expect(await requirement.json()).toMatchObject({ error: "Root MFA requirement cannot be disabled" });
    expect(mfaRepositoryMock.resetMfaFactor).not.toHaveBeenCalled();
    expect(mfaRepositoryMock.setMfaRequirement).not.toHaveBeenCalled();
  });
});
