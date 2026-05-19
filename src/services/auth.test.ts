import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, isTokenExpired, login, restoreSession } from "./auth";

const authMocks = vi.hoisted(() => ({
  appsScriptUrl: "",
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

vi.mock("./users", () => ({
  authenticateUser: authMocks.authenticateUser
}));

describe("auth service", () => {
  afterEach(() => {
    authMocks.appsScriptUrl = "";
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

  it("uses the Apps Script auth API path when configured", async () => {
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
