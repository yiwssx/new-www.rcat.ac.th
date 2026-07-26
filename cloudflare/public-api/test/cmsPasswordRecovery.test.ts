// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { AdminUserLifecycleConflict, type AdminUserLifecycleRepository } from "../src/db/adminUserLifecycleRepository";
import { CMS_AUTH_PROXY_SECRET_HEADER, handleCmsAuthInternal } from "../src/routes/cmsAuthInternal";
import type { Env } from "../src/env";

const proxySecret = "phase-5-reset-proxy-secret-repeated-000000000000000";
const token = "R".repeat(43);
const now = new Date("2026-07-22T05:00:00.000Z");
const inspection = {
  resetTokenId: "reset-1",
  userId: "user-1",
  email: "account@example.test",
  expiresAt: "2026-07-22T05:30:00.000Z"
};

function env(): Env {
  return { CMS_AUTH_PROXY_SECRET: proxySecret };
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
    inspectPasswordResetByTokenHash: vi.fn().mockResolvedValue(inspection),
    completePasswordReset: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as AdminUserLifecycleRepository;
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("CMS password recovery", () => {
  it("inspects without consuming and returns only a masked email hint", async () => {
    const lifecycleRepository = repository();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/password-reset/inspect", { token }),
      env(),
      { lifecycleRepository, now: () => now }
    );
    expect(response?.status).toBe(200);
    await expect(json(response!)).resolves.toEqual({
      valid: true,
      user: { emailHint: "a***@example.test" },
      expiresAt: inspection.expiresAt
    });
    expect(lifecycleRepository.completePasswordReset).not.toHaveBeenCalled();
  });

  it.each(["invalid", "expired", "used", "revoked", "disabled", "root", "credentialless"])(
    "uses one error for a %s reset link",
    async () => {
      const response = await handleCmsAuthInternal(
        request("/api/internal/cms-auth/password-reset/inspect", { token }),
        env(),
        { lifecycleRepository: repository({ inspectPasswordResetByTokenHash: vi.fn().mockResolvedValue(null) }) }
      );
      expect(response?.status).toBe(400);
      await expect(json(response!)).resolves.toMatchObject({ error: "password-reset link is invalid or expired" });
    }
  );

  it("rejects malformed tokens before D1 lookup", async () => {
    const lifecycleRepository = repository();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/password-reset/inspect", { token: "bad" }),
      env(),
      { lifecycleRepository }
    );
    expect(response?.status).toBe(400);
    expect(lifecycleRepository.inspectPasswordResetByTokenHash).not.toHaveBeenCalled();
  });

  it("enforces confirmation and password policy before hashing", async () => {
    const lifecycleRepository = repository();
    const hashPassword = vi.fn();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/password-reset/complete", {
        token,
        password: "short",
        passwordConfirmation: "short"
      }),
      env(),
      { lifecycleRepository, hashPassword }
    );
    expect(response?.status).toBe(400);
    expect(hashPassword).not.toHaveBeenCalled();
    expect(lifecycleRepository.completePasswordReset).not.toHaveBeenCalled();
  });

  it("completes with bcrypt-sha384-v1 inputs and creates no Session", async () => {
    const lifecycleRepository = repository();
    const createSession = vi.fn();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/password-reset/complete", {
        token,
        password: "a replacement password",
        passwordConfirmation: "a replacement password"
      }),
      env(),
      {
        lifecycleRepository,
        hashPassword: vi.fn().mockResolvedValue("replacement-hash"),
        createSession,
        now: () => now
      }
    );
    const serializedCall = JSON.stringify(vi.mocked(lifecycleRepository.completePasswordReset).mock.calls);

    expect(response?.status).toBe(200);
    await expect(json(response!)).resolves.toEqual({ ok: true, passwordReset: true });
    expect(lifecycleRepository.completePasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        resetTokenId: inspection.resetTokenId,
        userId: inspection.userId,
        passwordHash: "replacement-hash",
        passwordAlgorithm: "bcrypt-sha384-v1",
        now: now.toISOString()
      })
    );
    expect(serializedCall).not.toContain(token);
    expect(serializedCall).not.toContain("a replacement password");
    expect(createSession).not.toHaveBeenCalled();
    expect(response?.headers.get("Set-Cookie")).toBeNull();
  });

  it("fails closed on concurrent token reuse", async () => {
    const lifecycleRepository = repository({
      completePasswordReset: vi.fn().mockRejectedValue(new AdminUserLifecycleConflict("invalid_password_reset"))
    });
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/password-reset/complete", {
        token,
        password: "a replacement password",
        passwordConfirmation: "a replacement password"
      }),
      env(),
      { lifecycleRepository, hashPassword: vi.fn().mockResolvedValue("replacement-hash") }
    );
    expect(response?.status).toBe(400);
    await expect(json(response!)).resolves.toMatchObject({ error: "password-reset link is invalid or expired" });
  });
});
