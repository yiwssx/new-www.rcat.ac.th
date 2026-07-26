// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_NEW_CSRF_TOKEN_HEADER,
  CMS_NEW_SESSION_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  handleCmsAuthInternal,
  type CmsAuthInternalDependencies
} from "../src/routes/cmsAuthInternal";
import type { Env } from "../src/env";

const workerOrigin = "https://worker.example.invalid";
const proxySecret = "test-only-cms-proxy-secret-repeated-000000000000";
const sessionToken = "A".repeat(43);
const csrfToken = "B".repeat(43);
const identity = {
  id: "admin-user-1",
  email: "admin@example.invalid",
  name: "Admin User",
  username: "admin.user",
  role: "admin" as const,
  isRoot: true,
  sessionId: "admin-session-1",
  sessionVersion: 3,
  reauthenticatedAt: "2026-07-22T03:00:00.000Z",
  mfaVerifiedAt: "2026-07-22T03:00:00.000Z"
};
const credentialIdentity = {
  id: identity.id,
  email: identity.email,
  name: identity.name,
  username: identity.username,
  role: identity.role,
  isRoot: identity.isRoot,
  mustChangePassword: false,
  mfaRequired: false,
  sessionVersion: identity.sessionVersion
};

function env(overrides: Partial<Env> = {}): Env {
  return { CMS_AUTH_PROXY_SECRET: proxySecret, ...overrides };
}

function request(path: string, options: { body?: unknown; headers?: Record<string, string>; method?: string } = {}) {
  const headers = new Headers({ [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret, ...options.headers });
  const body =
    options.body === undefined
      ? undefined
      : typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return new Request(`${workerOrigin}${path}`, { method: options.method ?? "POST", headers, body });
}

function successDependencies(): CmsAuthInternalDependencies {
  return {
    verifyCredential: vi.fn().mockResolvedValue({ status: "success", identity: credentialIdentity }),
    createSession: vi.fn().mockResolvedValue({ identity, sessionToken, csrfToken }),
    authenticateSession: vi.fn().mockResolvedValue({ status: "authenticated", identity }),
    revokeSession: vi.fn().mockResolvedValue({ status: "authenticated", identity }),
    revokeAllSessions: vi.fn().mockResolvedValue({ status: "authenticated", identity }),
    mfaRepository: {
      getUserState: vi.fn().mockResolvedValue({
        user: {
          id: credentialIdentity.id,
          email: credentialIdentity.email,
          name: credentialIdentity.name,
          username: credentialIdentity.username,
          role: credentialIdentity.role,
          status: "active",
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
          created_by: "fixture",
          updated_by: "fixture",
          revision: 1,
          is_root: 0,
          must_change_password: 0,
          mfa_required: 0,
          session_version: credentialIdentity.sessionVersion,
          last_login_at: ""
        },
        factor: null,
        recoveryCodesRemaining: 0
      })
    } as unknown as CmsAuthInternalDependencies["mfaRepository"],
    now: () => new Date("2026-07-22T03:00:00.000Z")
  };
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("Worker internal CMS-auth routes", () => {
  it("rejects missing-secret, invalid-secret, and browser-Origin requests", async () => {
    const missing = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", { body: {}, headers: { [CMS_AUTH_PROXY_SECRET_HEADER]: "" } }),
      env()
    );
    const invalid = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", {
        body: {},
        headers: { [CMS_AUTH_PROXY_SECRET_HEADER]: "x".repeat(43) }
      }),
      env()
    );
    const browser = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", { body: {}, headers: { Origin: "https://admin.example.invalid" } }),
      env()
    );

    expect(missing?.status).toBe(403);
    expect(invalid?.status).toBe(403);
    expect(browser?.status).toBe(403);
  });

  it("fails closed with generic 503 when enabled without a sufficiently long configured secret", async () => {
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", { body: {} }),
      env({ CMS_AUTH_PROXY_SECRET: "short" })
    );
    expect(response?.status).toBe(503);
    expect(JSON.stringify(await json(response!))).not.toMatch(/CMS_AUTH_PROXY_SECRET|short/);
  });

  it("bounds malformed and oversized Login bodies", async () => {
    const malformed = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", { body: "{" }),
      env(),
      successDependencies()
    );
    const oversized = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", { body: "x".repeat(16 * 1024 + 1) }),
      env(),
      successDependencies()
    );

    expect(malformed?.status).toBe(400);
    expect(oversized?.status).toBe(413);
  });

  it.each(["invalid", "locked"] as const)("maps %s credentials to the same generic 401", async (status) => {
    const dependencies = successDependencies();
    dependencies.verifyCredential = vi
      .fn()
      .mockResolvedValue(status === "locked" ? { status, retryAfterSeconds: 900 } : { status });
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", { body: { identifier: "unknown", password: "wrong" } }),
      env(),
      dependencies
    );

    const responseBody = await json(response!);
    expect(response?.status).toBe(401);
    expect(responseBody).toMatchObject({ error: "invalid identifier or password" });
    expect(JSON.stringify(responseBody)).not.toContain("locked");
  });

  it("maps unavailable credential verification to generic 503", async () => {
    const dependencies = successDependencies();
    dependencies.verifyCredential = vi.fn().mockResolvedValue({ status: "unavailable" });
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", { body: { identifier: "admin", password: "password" } }),
      env(),
      dependencies
    );
    expect(response?.status).toBe(503);
  });

  it("creates a Session and returns safe JSON with raw tokens only in private response headers", async () => {
    const dependencies = successDependencies();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/login", {
        body: { identifier: "ADMIN.USER", password: " exact password " },
        headers: { "X-RCAT-CMS-Client-IP": "192.0.2.10", "X-RCAT-CMS-User-Agent": "test-browser" }
      }),
      env(),
      dependencies
    );
    const body = await response!.text();

    expect(response?.status).toBe(200);
    expect(response?.headers.get(CMS_NEW_SESSION_TOKEN_HEADER)).toBe(sessionToken);
    expect(response?.headers.get(CMS_NEW_CSRF_TOKEN_HEADER)).toBe(csrfToken);
    expect(response?.headers.get("Set-Cookie")).toBeNull();
    expect(body).toContain(identity.email);
    expect(body).not.toContain(sessionToken);
    expect(body).not.toContain(csrfToken);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(dependencies.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ clientIp: "192.0.2.10", userAgent: "test-browser" })
    );
  });

  it("validates an opaque token for GET Session without requiring CSRF", async () => {
    const dependencies = successDependencies();
    const response = await handleCmsAuthInternal(
      request("/api/internal/cms-auth/session", {
        method: "GET",
        headers: { [CMS_SESSION_TOKEN_HEADER]: sessionToken }
      }),
      env(),
      dependencies
    );

    expect(response?.status).toBe(200);
    expect(dependencies.authenticateSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken, method: "GET" })
    );
  });

  it.each([
    ["logout", "revokeSession"],
    ["logout-all", "revokeAllSessions"]
  ] as const)("requires syntactically valid CSRF for %s", async (route, dependencyName) => {
    const dependencies = successDependencies();
    const missing = await handleCmsAuthInternal(
      request(`/api/internal/cms-auth/${route}`, { headers: { [CMS_SESSION_TOKEN_HEADER]: sessionToken } }),
      env(),
      dependencies
    );
    const valid = await handleCmsAuthInternal(
      request(`/api/internal/cms-auth/${route}`, {
        headers: { [CMS_SESSION_TOKEN_HEADER]: sessionToken, [CMS_CSRF_TOKEN_HEADER]: csrfToken }
      }),
      env(),
      dependencies
    );

    expect(missing?.status).toBe(403);
    expect(valid?.status).toBe(200);
    expect(dependencies[dependencyName]).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken, csrfToken, method: "POST" })
    );
  });

  it.each([
    ["/api/internal/cms-auth/login", "GET", "POST"],
    ["/api/internal/cms-auth/session", "POST", "GET"],
    ["/api/internal/cms-auth/logout", "GET", "POST"],
    ["/api/internal/cms-auth/logout-all", "DELETE", "POST"]
  ])("returns 405 for unsupported method on %s", async (path, method, allow) => {
    const response = await handleCmsAuthInternal(request(path, { method }), env(), successDependencies());
    expect(response?.status).toBe(405);
    expect(response?.headers.get("Allow")).toBe(allow);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
  });
});
