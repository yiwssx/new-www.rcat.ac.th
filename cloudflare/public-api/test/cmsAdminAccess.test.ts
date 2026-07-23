// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authenticateAdminRequest } from "../src/auth/adminAccess";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER
} from "../src/routes/cmsAuthInternal";
import type { Env } from "../src/env";

const proxySecret = "test-only-cms-proxy-secret-repeated-000000000000";
const sessionToken = "A".repeat(43);
const csrfToken = "B".repeat(43);

function cmsEnv(overrides: Partial<Env> = {}): Env {
  return { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: proxySecret, ...overrides };
}

function cmsRequest(options: { method?: string; headers?: Record<string, string> } = {}) {
  return new Request("https://worker.example.invalid/api/admin/snapshot", {
    method: options.method ?? "GET",
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret,
      [CMS_SESSION_TOKEN_HEADER]: sessionToken,
      ...options.headers
    }
  });
}

function authenticated(role: "admin" | "editor" | "viewer" = "admin") {
  return {
    status: "authenticated" as const,
    identity: {
      id: "admin-user-1",
      email: "admin@example.invalid",
      name: "Admin User",
      username: "admin.user",
      role,
      isRoot: role === "admin",
      sessionId: "admin-session-1",
      sessionVersion: 3,
      reauthenticatedAt: "2026-07-23T03:00:00.000Z",
      mfaVerifiedAt: role === "admin" ? "2026-07-23T03:00:00.000Z" : ""
    }
  };
}

describe("CMS Session Worker Admin access", () => {
  it("authenticates independently of the legacy preview gate and uses current D1 role", async () => {
    const authenticateCmsSession = vi.fn().mockResolvedValue(authenticated("editor"));
    const result = await authenticateAdminRequest(cmsRequest(), cmsEnv(), { authenticateCmsSession });

    expect(result).toEqual({
      identity: {
        actor: "admin@example.invalid",
        email: "admin@example.invalid",
        mode: "cms-session",
        role: "editor",
        userId: "admin-user-1",
        sessionId: "admin-session-1",
        isRoot: false,
        reauthenticatedAt: "2026-07-23T03:00:00.000Z",
        mfaVerifiedAt: ""
      },
      response: null
    });
    expect(authenticateCmsSession).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", sessionToken }));
  });

  it("never accepts request-supplied proxy email or role for a CMS Session", async () => {
    const authenticateCmsSession = vi.fn().mockResolvedValue(authenticated("viewer"));
    const result = await authenticateAdminRequest(
      cmsRequest({
        headers: { "X-RCAT-Admin-Proxy-Email": "attacker@example.invalid", "X-RCAT-Admin-Proxy-Role": "admin" }
      }),
      cmsEnv(),
      { authenticateCmsSession }
    );

    expect(result.identity).toMatchObject({ email: "admin@example.invalid", role: "viewer" });
  });

  it("returns 401 for an invalid CMS token and never falls back to valid smoke headers", async () => {
    const authenticateCmsSession = vi.fn().mockResolvedValue({ status: "unauthenticated" });
    const result = await authenticateAdminRequest(
      cmsRequest({
        headers: {
          "X-RCAT-Admin-Smoke-Token": "valid-smoke",
          "X-RCAT-Admin-Proxy-Email": "legacy@example.invalid",
          "X-RCAT-Admin-Proxy-Role": "admin"
        }
      }),
      cmsEnv({
        ADMIN_WRITE_PREVIEW_ENABLED: "true",
        ADMIN_WRITE_SMOKE_ENABLED: "true",
        ADMIN_WRITE_SMOKE_TOKEN: "valid-smoke"
      }),
      { authenticateCmsSession }
    );

    expect(result.identity).toBeNull();
    expect(result.response?.status).toBe(401);
  });

  it.each([
    ["missing", undefined],
    ["incorrect", "C".repeat(43)]
  ])("returns 403 when a CMS mutation has %s CSRF", async (_label, token) => {
    const authenticateCmsSession = vi.fn().mockResolvedValue({ status: "forbidden" });
    const result = await authenticateAdminRequest(
      cmsRequest({ method: "POST", headers: token ? { [CMS_CSRF_TOKEN_HEADER]: token } : {} }),
      cmsEnv(),
      { authenticateCmsSession }
    );

    expect(result.response?.status).toBe(403);
  });

  it("passes valid CSRF to D1 Session authorization", async () => {
    const authenticateCmsSession = vi.fn().mockResolvedValue(authenticated());
    const result = await authenticateAdminRequest(
      cmsRequest({ method: "DELETE", headers: { [CMS_CSRF_TOKEN_HEADER]: csrfToken } }),
      cmsEnv(),
      { authenticateCmsSession }
    );

    expect(result.identity?.mode).toBe("cms-session");
    expect(authenticateCmsSession).toHaveBeenCalledWith(
      expect.objectContaining({ method: "DELETE", csrfToken, sessionToken })
    );
  });

  it.each(["disabled user", "Session-version mismatch"])("rejects %s immediately without fallback", async () => {
    const authenticateCmsSession = vi.fn().mockResolvedValue({ status: "unauthenticated" });
    const result = await authenticateAdminRequest(cmsRequest(), cmsEnv(), { authenticateCmsSession });
    expect(result.response?.status).toBe(401);
  });

  it("preserves the existing smoke-token path when no CMS private headers are present", async () => {
    const request = new Request("https://worker.example.invalid/api/admin/snapshot", {
      headers: {
        "X-RCAT-Admin-Smoke-Token": "legacy-smoke",
        "X-RCAT-Admin-Proxy-Email": "legacy@example.invalid",
        "X-RCAT-Admin-Proxy-Role": "admin"
      }
    });
    const result = await authenticateAdminRequest(request, {
      ADMIN_WRITE_PREVIEW_ENABLED: "true",
      ADMIN_WRITE_SMOKE_ENABLED: "true",
      ADMIN_WRITE_SMOKE_TOKEN: "legacy-smoke"
    });

    expect(result.identity).toMatchObject({ mode: "smoke-token", email: "legacy@example.invalid", role: "admin" });
  });

  it("preserves production-context protection for legacy smoke authentication", async () => {
    const request = new Request("https://worker.example.invalid/api/admin/snapshot", {
      headers: { "X-RCAT-Admin-Smoke-Token": "legacy-smoke" }
    });
    const result = await authenticateAdminRequest(request, {
      ADMIN_WRITE_PREVIEW_ENABLED: "true",
      ADMIN_WRITE_SMOKE_ENABLED: "true",
      ADMIN_WRITE_SMOKE_TOKEN: "legacy-smoke",
      ENVIRONMENT: "production"
    });

    expect(result.response?.status).toBe(403);
    expect(result.identity).toBeNull();
  });
});
