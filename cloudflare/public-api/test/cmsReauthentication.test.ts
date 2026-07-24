// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CMS_REAUTH_FRESHNESS_SECONDS, hasRecentAdminAssurance, requireAdminStepUp } from "../src/auth/adminStepUp";
import type { AdminIdentity } from "../src/auth/adminAccess";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  handleCmsAuthInternal
} from "../src/routes/cmsAuthInternal";
import type { AdminMfaRepository } from "../src/db/adminMfaRepository";
import type { AdminUserLifecycleRepository } from "../src/db/adminUserLifecycleRepository";

const now = new Date("2026-07-23T03:00:00.000Z");
const proxySecret = "S".repeat(40);
const identity: AdminIdentity = {
  actor: "admin@example.invalid",
  email: "admin@example.invalid",
  mode: "cms-session",
  role: "admin",
  reauthenticatedAt: now.toISOString(),
  mfaVerifiedAt: now.toISOString()
};

function reauthenticationRequest(body: Record<string, unknown>) {
  return new Request("https://worker.invalid/api/internal/cms-auth/reauthenticate", {
    method: "POST",
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret,
      [CMS_SESSION_TOKEN_HEADER]: "A".repeat(43),
      [CMS_CSRF_TOKEN_HEADER]: "B".repeat(43),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function authenticatedSession() {
  return {
    status: "authenticated" as const,
    identity: {
      id: "admin-user-1",
      email: "admin@example.invalid",
      name: "Admin",
      username: "admin",
      role: "admin" as const,
      isRoot: false,
      sessionId: "current-session",
      sessionVersion: 3,
      reauthenticatedAt: "",
      mfaVerifiedAt: ""
    }
  };
}

function storedUser(mfaRequired = false) {
  return {
    id: "admin-user-1",
    email: "admin@example.invalid",
    name: "Admin",
    username: "admin",
    role: "admin" as const,
    status: "active" as const,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    created_by: "fixture",
    updated_by: "fixture",
    revision: 1,
    is_root: 0 as const,
    must_change_password: 0 as const,
    mfa_required: (mfaRequired ? 1 : 0) as 0 | 1,
    session_version: 3,
    last_login_at: ""
  };
}

function lifecycleRepository() {
  return {
    getCredentialByUserId: vi.fn(async () => ({
      user_id: "admin-user-1",
      password_hash: "stored-hash",
      password_algorithm: "bcrypt"
    }))
  } as unknown as AdminUserLifecycleRepository;
}

describe("CMS reauthentication assurance", () => {
  it("accepts a canonical recent timestamp but treats the exact ten-minute boundary as stale", () => {
    expect(hasRecentAdminAssurance(identity, "password", now)).toBe(true);
    expect(
      hasRecentAdminAssurance(
        {
          ...identity,
          reauthenticatedAt: new Date(now.getTime() - CMS_REAUTH_FRESHNESS_SECONDS * 1000).toISOString()
        },
        "password",
        now
      )
    ).toBe(false);
  });

  it("fails closed for malformed and future assurance", () => {
    expect(hasRecentAdminAssurance({ ...identity, mfaVerifiedAt: "not-a-time" }, "mfa", now)).toBe(false);
    expect(
      hasRecentAdminAssurance({ ...identity, mfaVerifiedAt: new Date(now.getTime() + 1).toISOString() }, "mfa", now)
    ).toBe(false);
  });

  it("requires recent MFA when a Root CMS Session targets its own user route", async () => {
    const response = await requireAdminStepUp({
      env: {},
      identity: { ...identity, isRoot: true, mfaVerifiedAt: "" },
      method: "PATCH",
      segments: ["users", "me"],
      now
    });
    expect(response?.status).toBe(428);
    expect(await response?.json()).toMatchObject({ assurance: "mfa" });
  });

  it("treats empty migration assurance as authenticated but stale for password step-up", async () => {
    const response = await requireAdminStepUp({
      env: {},
      identity: { ...identity, reauthenticatedAt: "" },
      method: "PATCH",
      segments: ["settings"],
      now
    });

    expect(response?.status).toBe(428);
    expect(await response?.json()).toMatchObject({ error: "reauthentication required", assurance: "password" });
  });

  it("reauthenticates an empty-assurance password Session and updates only its current Session", async () => {
    const reauthenticateSession = vi.fn(async () => undefined);
    const mfaRepository = {
      getUserState: vi.fn(async () => ({ user: storedUser(), factor: null, recoveryCodesRemaining: 0 })),
      reauthenticateSession
    } as unknown as AdminMfaRepository;
    const response = await handleCmsAuthInternal(
      reauthenticationRequest({ currentPassword: "correct password" }),
      { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: proxySecret },
      {
        now: () => now,
        authenticateSession: vi.fn(async () => authenticatedSession()),
        lifecycleRepository: lifecycleRepository(),
        mfaRepository,
        verifyPassword: vi.fn(async () => true)
      }
    );

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ ok: true, reauthenticated: true, mfaVerified: false });
    expect(reauthenticateSession).toHaveBeenCalledOnce();
    expect(reauthenticateSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "current-session", userId: "admin-user-1", proof: undefined })
    );
  });

  it.each([
    ["wrong current password", false, false],
    ["missing MFA proof for an MFA account", true, true]
  ])("returns one generic Worker error for %s", async (_label, mfaRequired, passwordValid) => {
    const mfaRepository = {
      getUserState: vi.fn(async () => ({
        user: storedUser(mfaRequired),
        factor: mfaRequired
          ? {
              user_id: "admin-user-1",
              encrypted_secret: "hidden",
              iv: "hidden",
              key_version: "v1",
              state: "enabled",
              created_at: now.toISOString(),
              enabled_at: now.toISOString(),
              updated_at: now.toISOString(),
              last_used_step: 0
            }
          : null,
        recoveryCodesRemaining: mfaRequired ? 10 : 0
      })),
      reauthenticateSession: vi.fn()
    } as unknown as AdminMfaRepository;
    const response = await handleCmsAuthInternal(
      reauthenticationRequest({ currentPassword: "wrong-or-incomplete" }),
      { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: proxySecret },
      {
        now: () => now,
        authenticateSession: vi.fn(async () => authenticatedSession()),
        lifecycleRepository: lifecycleRepository(),
        mfaRepository,
        verifyPassword: vi.fn(async () => passwordValid)
      }
    );

    expect(response?.status).toBe(401);
    expect(await response?.json()).toMatchObject({ error: "reauthentication failed" });
    expect(mfaRepository.reauthenticateSession).not.toHaveBeenCalled();
  });
});
