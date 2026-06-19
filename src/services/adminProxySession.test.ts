import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminProxySessionEnabled, loginAdminProxySession, logoutAdminProxySession } from "./adminProxySession";

describe("admin proxy browser session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is enabled only for the explicit Cloudflare server-proxy configuration", () => {
    expect(
      isAdminProxySessionEnabled({
        VITE_ADMIN_WRITE_PROVIDER: "cloudflare",
        VITE_BACKEND_MIGRATION_MODE: "cloudflare-first-preview",
        VITE_CLOUDFLARE_ADMIN_AUTH_MODE: "server-proxy",
        VITE_CLOUDFLARE_ADMIN_PROXY_URL: "/api/admin-proxy"
      })
    ).toBe(true);
    expect(
      isAdminProxySessionEnabled({
        VITE_ADMIN_WRITE_PROVIDER: "cloudflare",
        VITE_BACKEND_MIGRATION_MODE: "cloudflare-first-preview",
        VITE_CLOUDFLARE_ADMIN_AUTH_MODE: "cloudflare-access",
        VITE_CLOUDFLARE_PUBLIC_API_URL: "https://preview-worker.example.test"
      })
    ).toBe(false);
  });

  it("creates and clears the same-origin HttpOnly session without browser-visible Worker credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await loginAdminProxySession("admin@example.test", "test-password");
    await logoutAdminProxySession();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin-proxy-session/login");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ email: "admin@example.test", password: "test-password" })
    });
    const loginHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(loginHeaders.get("Content-Type")).toBe("application/json");
    expect(loginHeaders.has("X-RCAT-Admin-Smoke-Token")).toBe(false);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin-proxy-session/logout");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include"
    });
  });

  it("surfaces a clear login failure without exposing response details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "invalid email or password" }), {
            status: 401,
            headers: { "content-type": "application/json" }
          })
      )
    );

    await expect(loginAdminProxySession("admin@example.test", "wrong-password")).rejects.toThrow(
      "invalid email or password"
    );
  });
});
