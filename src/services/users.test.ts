import { afterEach, describe, expect, it, vi } from "vitest";
import { getUserAccounts } from "./users";

const userMocks = vi.hoisted(() => ({
  appsScriptUrl: "",
  getUserAccountsFromApi: vi.fn(async () => [
    {
      id: "api-user",
      name: "API User",
      email: "API@EXAMPLE.COM",
      role: "admin" as const,
      status: "active" as const,
      passwordHash: "",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z"
    }
  ])
}));

vi.mock("../config/projectSettings", () => ({
  getGoogleAppsScriptUrl: () => userMocks.appsScriptUrl,
  projectSettings: {
    api: {
      googleAppsScriptUrlEnv: "VITE_GOOGLE_APPS_SCRIPT_URL"
    },
    auth: {
      bootstrapUsers: [
        {
          id: "bootstrap-admin",
          name: "Bootstrap Admin",
          email: "ADMIN@EXAMPLE.COM",
          role: "admin",
          status: "active",
          passwordHash: "$2a$08$test",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z"
        }
      ]
    }
  }
}));

vi.mock("./googleApi", () => ({
  deleteUserAccountFromApi: vi.fn(),
  getUserAccountsFromApi: userMocks.getUserAccountsFromApi,
  resetUserAccountsFromApi: vi.fn(),
  saveUserAccountToApi: vi.fn()
}));

describe("user service backend boundary", () => {
  afterEach(() => {
    userMocks.appsScriptUrl = "";
    userMocks.getUserAccountsFromApi.mockClear();
    vi.unstubAllEnvs();
  });

  it("keeps local bootstrap user fallback available outside production", async () => {
    const users = await getUserAccounts();

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      id: "bootstrap-admin",
      email: "admin@example.com"
    });
    expect(userMocks.getUserAccountsFromApi).not.toHaveBeenCalled();
  });

  it("fails closed in production when Apps Script user management is missing", async () => {
    vi.stubEnv("MODE", "production");

    await expect(getUserAccounts()).rejects.toThrow("VITE_GOOGLE_APPS_SCRIPT_URL");
    expect(userMocks.getUserAccountsFromApi).not.toHaveBeenCalled();
  });

  it("uses backend user management when Apps Script is configured", async () => {
    userMocks.appsScriptUrl = "https://script.google.com/macros/s/example/exec";

    const users = await getUserAccounts();

    expect(users[0]).toMatchObject({
      id: "api-user",
      email: "api@example.com"
    });
    expect(userMocks.getUserAccountsFromApi).toHaveBeenCalledTimes(1);
  });
});
