import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, isTokenExpired, login, restoreSession } from "./auth";

const authMocks = vi.hoisted(() => ({
  adminProvider: "apps-script" as "apps-script" | "cloudflare",
  appsScriptUrl: "",
  proxyEnabled: false,
  proxyLogin: vi.fn(async (email: string) => ({
    user: {
      id: `admin-proxy:${email}`,
      name: "admin",
      email,
      role: "admin" as const
    },
    token: "admin-proxy.local.test.token",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  })),
  authenticateUser: vi.fn(async (email: string) => ({
    id: "user-test",
    name: "Test User",
    email,
    role: "admin" as const,
    status: "active" as const,
    passwordHash: "$2a$08$test",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z"
  })),
  loginUserFromApi: vi.fn(async (email: string) => ({
    user: {
      id: "api-user",
      name: "API User",
      email,
      role: "editor" as const
    },
    token: "api.token",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  }))
}));

vi.mock("../config/adminWriteProvider", () => ({
  getAdminWriteProvider: () => authMocks.adminProvider
}));

vi.mock("../config/projectSettings", () => ({
  getGoogleAppsScriptUrl: () => authMocks.appsScriptUrl,
  projectSettings: {
    api: {
      googleAppsScriptUrlEnv: "VITE_GOOGLE_APPS_SCRIPT_URL"
    },
    auth: {
      sessionHours: 8
    }
  }
}));

vi.mock("./googleApi", () => ({
  loginUserFromApi: authMocks.loginUserFromApi
}));

vi.mock("./adminProxySession", () => ({
  isAdminProxySessionEnabled: () => authMocks.proxyEnabled,
  loginCloudflareAdminProxySession: authMocks.proxyLogin
}));

vi.mock("./users", () => ({
  authenticateUser: authMocks.authenticateUser
}));

describe("auth service", () => {
  afterEach(() => {
    authMocks.adminProvider = "apps-script";
    authMocks.appsScriptUrl = "";
    authMocks.proxyEnabled = false;
    authMocks.proxyLogin.mockClear();
    authMocks.authenticateUser.mockClear();
    authMocks.loginUserFromApi.mockClear();
    vi.unstubAllEnvs();
  });

  it("creates a session token for an authenticated user", async () => {
    const session = await login("admin@example.com", "password");

    expect(session.user.email).toBe("admin@example.com");
    expect(session.token.split(".")).toHaveLength(3);
    expect(isTokenExpired(session.token, session.expiresAt)).toBe(false);
    expect(authMocks.authenticateUser).toHaveBeenCalledWith("admin@example.com", "password");
  });

  it("uses the Apps Script auth API path only for the Apps Script admin provider", async () => {
    authMocks.appsScriptUrl = "https://script.google.com/macros/s/example/exec";

    const session = await login("editor@example.com", "password");

    expect(session.user).toMatchObject({
      id: "api-user",
      email: "editor@example.com",
      role: "editor"
    });
    expect(authMocks.loginUserFromApi).toHaveBeenCalledWith("editor@example.com", "password");
    expect(authMocks.authenticateUser).not.toHaveBeenCalled();
  });

  it("uses only the server proxy login when Cloudflare preview auth is enabled", async () => {
    authMocks.adminProvider = "cloudflare";
    authMocks.appsScriptUrl = "https://script.google.com/macros/s/example/exec";
    authMocks.proxyEnabled = true;

    const session = await login("admin@example.com", "password");

    expect(session).toMatchObject({
      user: { email: "admin@example.com", role: "admin" },
      token: "admin-proxy.local.test.token"
    });
    expect(authMocks.proxyLogin).toHaveBeenCalledWith("admin@example.com", "password");
    expect(authMocks.loginUserFromApi).not.toHaveBeenCalled();
    expect(authMocks.authenticateUser).not.toHaveBeenCalled();
  });

  it("does not fall back to Apps Script for other Cloudflare auth modes", async () => {
    authMocks.adminProvider = "cloudflare";
    authMocks.appsScriptUrl = "https://script.google.com/macros/s/example/exec";

    await expect(login("admin@example.com", "password")).rejects.toThrow(
      "Credential login is unavailable for the configured Cloudflare admin authentication mode"
    );
    expect(authMocks.loginUserFromApi).not.toHaveBeenCalled();
    expect(authMocks.authenticateUser).not.toHaveBeenCalled();
  });

  it("fails closed in production when Apps Script auth is missing", async () => {
    vi.stubEnv("MODE", "production");

    await expect(login("admin@example.com", "password")).rejects.toThrow("VITE_GOOGLE_APPS_SCRIPT_URL");
    expect(authMocks.authenticateUser).not.toHaveBeenCalled();
    expect(authMocks.loginUserFromApi).not.toHaveBeenCalled();
  });

  it("hashes passwords with bcrypt", async () => {
    const hash = await hashPassword("password");

    expect(hash).not.toBe("password");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("restores a saved session payload", async () => {
    const session = await login("admin@example.com", "password");

    expect(restoreSession(JSON.stringify(session))).toEqual(session);
    expect(restoreSession("bad-json")).toBeNull();
  });
});
