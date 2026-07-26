// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authenticateAdminRequest } from "../src/auth/adminAccess";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../src/routes/cmsAuthInternal";
import type { Env } from "../src/env";

const proxySecret = "test-only-cms-proxy-secret-repeated-000000000000";
const sessionToken = "A".repeat(43);
const csrfToken = "B".repeat(43);

function cmsEnv(overrides: Partial<Env> = {}): Env {
  return { CMS_AUTH_PROXY_SECRET: proxySecret, ...overrides };
}

function cmsRequest(options: { method?: string; headers?: Record<string, string> } = {}) {
  return new Request("https://worker.example.invalid/api/admin/snapshot", {
    method: options.method ?? "GET",
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret,
      [CMS_SESSION_TOKEN_HEADER]: sessionToken,
      [CMS_CLIENT_IP_HEADER]: "203.0.113.30",
      [CMS_USER_AGENT_HEADER]: "test-agent",
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

describe("CMS-only Worker Admin access", () => {
  it("derives the actor and role only from the validated D1 Session identity", async () => {
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
    expect(authenticateCmsSession).toHaveBeenCalledWith(
      expect.objectContaining({
        clientIp: "203.0.113.30",
        method: "GET",
        sessionToken,
        userAgent: "test-agent"
      })
    );
  });

  it("passes exact CSRF and metadata to D1 Session authorization", async () => {
    const authenticateCmsSession = vi.fn().mockResolvedValue(authenticated());
    const result = await authenticateAdminRequest(
      cmsRequest({ method: "DELETE", headers: { [CMS_CSRF_TOKEN_HEADER]: csrfToken } }),
      cmsEnv(),
      { authenticateCmsSession }
    );

    expect(result.identity?.mode).toBe("cms-session");
    expect(authenticateCmsSession).toHaveBeenCalledWith(
      expect.objectContaining({
        clientIp: "203.0.113.30",
        csrfToken,
        method: "DELETE",
        sessionToken,
        userAgent: "test-agent"
      })
    );
  });

  it("passes the read-only Session option for the media bridge authorization probe", async () => {
    const authenticateCmsSession = vi.fn().mockResolvedValue(authenticated());
    const result = await authenticateAdminRequest(
      cmsRequest({
        method: "POST",
        headers: { [CMS_CSRF_TOKEN_HEADER]: csrfToken }
      }),
      cmsEnv(),
      { authenticateCmsSession, touchSession: false }
    );

    expect(result.identity?.mode).toBe("cms-session");
    expect(authenticateCmsSession).toHaveBeenCalledWith(
      expect.objectContaining({
        csrfToken,
        method: "POST",
        touchSession: false
      })
    );
  });

  it.each([
    ["missing proxy secret", { [CMS_AUTH_PROXY_SECRET_HEADER]: "" }],
    ["incorrect proxy secret", { [CMS_AUTH_PROXY_SECRET_HEADER]: "wrong-secret" }],
    ["missing client IP", { [CMS_CLIENT_IP_HEADER]: "" }],
    ["missing user agent", { [CMS_USER_AGENT_HEADER]: "" }],
    ["oversized client IP metadata", { [CMS_CLIENT_IP_HEADER]: "x".repeat(65) }]
  ])("fails closed for %s", async (_label, headers) => {
    const authenticateCmsSession = vi.fn();
    const result = await authenticateAdminRequest(cmsRequest({ headers }), cmsEnv(), {
      authenticateCmsSession
    });

    expect(result.identity).toBeNull();
    expect(result.response?.status).toBe(403);
    expect(authenticateCmsSession).not.toHaveBeenCalled();
  });

  it("rejects browser-origin requests before D1 Session authorization", async () => {
    const authenticateCmsSession = vi.fn();
    const result = await authenticateAdminRequest(
      cmsRequest({ headers: { Origin: "https://cms.example.invalid" } }),
      cmsEnv(),
      { authenticateCmsSession }
    );

    expect(result.identity).toBeNull();
    expect(result.response?.status).toBe(403);
    expect(authenticateCmsSession).not.toHaveBeenCalled();
  });

  it.each([
    ["old smoke token", { "X-RCAT-Admin-Smoke-Token": "old-smoke-token" }],
    [
      "old proxy identity",
      {
        "X-RCAT-Admin-Proxy-Email": "attacker@example.invalid",
        "X-RCAT-Admin-Proxy-Role": "admin"
      }
    ],
    ["Access email", { "Cf-Access-Authenticated-User-Email": "attacker@example.invalid" }],
    ["Access assertion", { "Cf-Access-Jwt-Assertion": "old-access-jwt" }],
    ["old bearer token", { Authorization: "Bearer old-admin-token" }]
  ])("does not accept %s alone", async (_label, headers) => {
    const authenticateCmsSession = vi.fn();
    const request = new Request("https://worker.example.invalid/api/admin/snapshot", { headers });
    const result = await authenticateAdminRequest(request, cmsEnv(), { authenticateCmsSession });

    expect(result.identity).toBeNull();
    expect(result.response?.status).toBe(403);
    expect(authenticateCmsSession).not.toHaveBeenCalled();
  });

  it("ignores every old identity header when the CMS Session is valid", async () => {
    const authenticateCmsSession = vi.fn().mockResolvedValue(authenticated("viewer"));
    const result = await authenticateAdminRequest(
      cmsRequest({
        headers: {
          Authorization: "Bearer old-admin-token",
          "Cf-Access-Authenticated-User-Email": "attacker@example.invalid",
          "Cf-Access-Jwt-Assertion": "old-access-jwt",
          "X-RCAT-Admin-Smoke-Token": "old-smoke-token",
          "X-RCAT-Admin-Proxy-Email": "attacker@example.invalid",
          "X-RCAT-Admin-Proxy-Role": "admin"
        }
      }),
      cmsEnv(),
      { authenticateCmsSession }
    );

    expect(result.identity).toMatchObject({
      actor: "admin@example.invalid",
      email: "admin@example.invalid",
      role: "viewer"
    });
  });

  it.each([
    ["invalid or expired Session", { status: "unauthenticated" as const }, 401],
    ["failed CSRF", { status: "forbidden" as const }, 403],
    ["unavailable authentication", { status: "unavailable" as const }, 503]
  ])("maps %s without fallback", async (_label, authentication, expectedStatus) => {
    const authenticateCmsSession = vi.fn().mockResolvedValue(authentication);
    const result = await authenticateAdminRequest(cmsRequest(), cmsEnv(), { authenticateCmsSession });

    expect(result.identity).toBeNull();
    expect(result.response?.status).toBe(expectedStatus);
  });

  it("fails closed when mandatory CMS configuration is absent", async () => {
    const authenticateCmsSession = vi.fn();
    const result = await authenticateAdminRequest(cmsRequest(), cmsEnv({ CMS_AUTH_PROXY_SECRET: "" }), {
      authenticateCmsSession
    });

    expect(result.identity).toBeNull();
    expect(result.response?.status).toBe(503);
    expect(authenticateCmsSession).not.toHaveBeenCalled();
  });
});
