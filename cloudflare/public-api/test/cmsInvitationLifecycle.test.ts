// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { AdminUserLifecycleConflict, type AdminUserLifecycleRepository } from "../src/db/adminUserLifecycleRepository";
import { CMS_AUTH_PROXY_SECRET_HEADER, handleCmsAuthInternal } from "../src/routes/cmsAuthInternal";
import type { Env } from "../src/env";

const proxySecret = "phase-5-invitation-proxy-secret-repeated-000000000";
const token = "I".repeat(43);
const now = new Date("2026-07-22T04:00:00.000Z");
const inspection = {
  invitationId: "invitation-1",
  userId: "user-1",
  email: "invited@example.test",
  name: "Invited User",
  role: "editor" as const,
  username: null,
  expiresAt: "2026-07-25T04:00:00.000Z"
};

function env(): Env {
  return { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: proxySecret };
}

function request(path: string, body: unknown) {
  return new Request(`https://worker.example.test${path}`, {
    method: "POST",
    headers: { [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function repository(overrides: Partial<AdminUserLifecycleRepository> = {}) {
  return {
    inspectInvitationByTokenHash: vi.fn().mockResolvedValue(inspection),
    isUsernameAvailable: vi.fn().mockResolvedValue(true),
    acceptInvitation: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as AdminUserLifecycleRepository;
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("CMS invitation lifecycle", () => {
  it("inspects an active invitation without consuming it and exposes only safe profile state", async () => {
    const lifecycleRepository = repository();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/invitation/inspect", { token }),
      env(),
      { lifecycleRepository, now: () => now }
    );
    const body = await json(response!);

    expect(response?.status).toBe(200);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      valid: true,
      user: {
        email: inspection.email,
        name: inspection.name,
        role: inspection.role,
        username: null
      },
      expiresAt: inspection.expiresAt
    });
    expect(lifecycleRepository.acceptInvitation).not.toHaveBeenCalled();
  });

  it.each(["invalid", "expired", "revoked", "accepted", "disabled", "root"])(
    "returns the identical generic error for a %s invitation",
    async () => {
      const response = await handleCmsAuthInternal(
        request("/api/internal/cms-auth/invitation/inspect", { token }),
        env(),
        { lifecycleRepository: repository({ inspectInvitationByTokenHash: vi.fn().mockResolvedValue(null) }) }
      );
      expect(response?.status).toBe(400);
      await expect(json(response!)).resolves.toEqual({
        error: "invitation is invalid or expired",
        resource: "cms-auth"
      });
    }
  );

  it("rejects malformed tokens before a repository lookup", async () => {
    const lifecycleRepository = repository();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/invitation/inspect", { token: "malformed" }),
      env(),
      { lifecycleRepository }
    );
    expect(response?.status).toBe(400);
    expect(lifecycleRepository.inspectInvitationByTokenHash).not.toHaveBeenCalled();
  });

  it("enforces confirmation and the existing password policy before hashing or accepting", async () => {
    const lifecycleRepository = repository();
    const hashPassword = vi.fn();
    const mismatch = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/invitation/accept", {
        token,
        password: "a sufficiently long password",
        passwordConfirmation: "different sufficiently long password"
      }),
      env(),
      { lifecycleRepository, hashPassword }
    );
    const weak = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/invitation/accept", {
        token,
        password: "short",
        passwordConfirmation: "short"
      }),
      env(),
      { lifecycleRepository, hashPassword }
    );

    expect(mismatch?.status).toBe(400);
    expect(weak?.status).toBe(400);
    expect(hashPassword).not.toHaveBeenCalled();
    expect(lifecycleRepository.acceptInvitation).not.toHaveBeenCalled();
  });

  it("accepts exactly once using bcrypt-sha384-v1 inputs without creating a Session", async () => {
    const lifecycleRepository = repository();
    const createSession = vi.fn();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/invitation/accept", {
        token,
        password: "a new secure password",
        passwordConfirmation: "a new secure password",
        username: "Invited.User"
      }),
      env(),
      {
        lifecycleRepository,
        hashPassword: vi.fn().mockResolvedValue("stored-password-hash"),
        createSession,
        now: () => now
      }
    );
    const serializedCall = JSON.stringify(vi.mocked(lifecycleRepository.acceptInvitation).mock.calls);

    expect(response?.status).toBe(200);
    await expect(json(response!)).resolves.toEqual({ ok: true, credentialConfigured: true });
    expect(lifecycleRepository.acceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        invitationId: inspection.invitationId,
        userId: inspection.userId,
        passwordHash: "stored-password-hash",
        passwordAlgorithm: "bcrypt-sha384-v1",
        username: "invited.user"
      })
    );
    expect(serializedCall).not.toContain(token);
    expect(serializedCall).not.toContain("a new secure password");
    expect(createSession).not.toHaveBeenCalled();
    expect(response?.headers.get("Set-Cookie")).toBeNull();
  });

  it("enforces case-insensitive username uniqueness", async () => {
    const lifecycleRepository = repository({ isUsernameAvailable: vi.fn().mockResolvedValue(false) });
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/invitation/accept", {
        token,
        password: "a new secure password",
        passwordConfirmation: "a new secure password",
        username: "TAKEN.USER"
      }),
      env(),
      { lifecycleRepository }
    );
    expect(response?.status).toBe(409);
    expect(lifecycleRepository.acceptInvitation).not.toHaveBeenCalled();
  });

  it("does not allow a preassigned username to be replaced", async () => {
    const lifecycleRepository = repository({
      inspectInvitationByTokenHash: vi.fn().mockResolvedValue({ ...inspection, username: "assigned.user" })
    });
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/invitation/accept", {
        token,
        password: "a new secure password",
        passwordConfirmation: "a new secure password",
        username: "other.user"
      }),
      env(),
      { lifecycleRepository }
    );
    expect(response?.status).toBe(409);
    expect(lifecycleRepository.acceptInvitation).not.toHaveBeenCalled();
  });

  it("fails closed when concurrent reuse loses the repository claim", async () => {
    const lifecycleRepository = repository({
      acceptInvitation: vi.fn().mockRejectedValue(new AdminUserLifecycleConflict("invalid_invitation"))
    });
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/invitation/accept", {
        token,
        password: "a new secure password",
        passwordConfirmation: "a new secure password"
      }),
      env(),
      { lifecycleRepository, hashPassword: vi.fn().mockResolvedValue("stored-password-hash") }
    );
    expect(response?.status).toBe(400);
    await expect(json(response!)).resolves.toMatchObject({ error: "invitation is invalid or expired" });
  });
});
