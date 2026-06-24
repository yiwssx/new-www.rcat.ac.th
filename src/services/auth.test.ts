import { afterEach, describe, expect, it, vi } from "vitest";
import { isTokenExpired, login, restoreSession } from "./auth";

const authMocks = vi.hoisted(() => ({
  adminProvider: "cloudflare" as "apps-script" | "cloudflare",
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
  }))
}));

vi.mock("../config/adminWriteProvider", () => ({
  getAdminWriteProvider: () => authMocks.adminProvider
}));

vi.mock("./adminProxySession", () => ({
  isAdminProxySessionEnabled: () => authMocks.proxyEnabled,
  loginCloudflareAdminProxySession: authMocks.proxyLogin
}));

describe("auth service", () => {
  afterEach(() => {
    authMocks.adminProvider = "cloudflare";
    authMocks.proxyEnabled = false;
    authMocks.proxyLogin.mockClear();
    vi.unstubAllEnvs();
  });

  it("uses only the server proxy login when Cloudflare preview auth is enabled", async () => {
    authMocks.adminProvider = "cloudflare";
    authMocks.proxyEnabled = true;

    const session = await login("admin@example.com", "password");

    expect(session).toMatchObject({
      user: { email: "admin@example.com", role: "admin" },
      token: "admin-proxy.local.test.token"
    });
    expect(authMocks.proxyLogin).toHaveBeenCalledWith("admin@example.com", "password");
  });

  it("rejects legacy Apps Script credential login", async () => {
    authMocks.adminProvider = "apps-script";
    authMocks.proxyEnabled = false;

    await expect(login("admin@example.com", "password")).rejects.toThrow(
      "Legacy Apps Script credential login has been removed. Configure the Cloudflare admin proxy session."
    );
    expect(authMocks.proxyLogin).not.toHaveBeenCalled();
  });

  it("rejects Cloudflare credential login when the admin proxy session is not enabled", async () => {
    authMocks.adminProvider = "cloudflare";
    authMocks.proxyEnabled = false;

    await expect(login("admin@example.com", "password")).rejects.toThrow(
      "Credential login is unavailable for the configured Cloudflare admin authentication mode"
    );
    expect(authMocks.proxyLogin).not.toHaveBeenCalled();
  });

  it("detects expired and active session timestamps", () => {
    expect(isTokenExpired("admin-proxy.local.test.token", new Date(Date.now() + 60_000).toISOString())).toBe(false);
    expect(isTokenExpired("admin-proxy.local.test.token", new Date(Date.now() - 60_000).toISOString())).toBe(true);
  });

  it("restores a saved session payload", () => {
    const session = {
      user: {
        id: "admin-proxy:admin@example.com",
        name: "admin",
        email: "admin@example.com",
        role: "admin" as const
      },
      token: "admin-proxy.local.test.token",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    };

    expect(restoreSession(JSON.stringify(session))).toEqual(session);
    expect(restoreSession("bad-json")).toBeNull();
  });
});
