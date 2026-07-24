import { beforeEach, describe, expect, it, vi } from "vitest";
import { CMS_CSRF_COOKIE_NAME, CMS_CSRF_HEADER_NAME } from "./constants";
import { getCmsSession, loginCmsAccount, logoutCmsSession, startCmsMfaSetup, verifyCmsMfa } from "./client";

vi.mock("../../config/adminWriteProvider", () => ({
  buildCloudflareAdminApiUrl: (path: string) => `/api/admin-proxy?path=${encodeURIComponent(path)}`
}));

const safeUser = {
  id: "user-1",
  email: "user@example.test",
  name: "Test User",
  username: "test.user",
  role: "admin",
  isRoot: false,
  recentPasswordAuthentication: true,
  recentMfaAuthentication: false
};
const csrfToken = "C".repeat(43);

describe("CMS authentication client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses credentials and attaches the exact CSRF header to a Session mutation", async () => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${csrfToken}`);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await logoutCmsSession();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cms-auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.any(Headers)
      })
    );
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get(CMS_CSRF_HEADER_NAME)).toBe(csrfToken);
  });

  it("does not attach Session CSRF to Login or Challenge requests", async () => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${csrfToken}`);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ mfaRequired: true, enrollmentRequired: false }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ ok: true, user: safeUser }));

    await loginCmsAccount("user", " password ");
    await verifyCmsMfa({ totpCode: "123456" });

    for (const call of fetchMock.mock.calls) {
      expect(new Headers(call[1]?.headers).has(CMS_CSRF_HEADER_NAME)).toBe(false);
    }
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      identifier: "user",
      password: " password "
    });
  });

  it("uses no CSRF for mandatory enrollment and requires it for Session enrollment", async () => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${csrfToken}`);
    const setup = {
      manualEntryKey: "MANUALKEY",
      otpAuthUri: "otpauth://totp/RCAT:user",
      expiresAt: "2026-07-25T00:00:00.000Z"
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(setup))
      .mockResolvedValueOnce(Response.json(setup));

    await startCmsMfaSetup("challenge");
    await startCmsMfaSetup("session");

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has(CMS_CSRF_HEADER_NAME)).toBe(false);
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get(CMS_CSRF_HEADER_NAME)).toBe(csrfToken);
  });

  it("rejects browser user payloads containing Session internals", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ ok: true, user: { ...safeUser, sessionId: "must-not-enter-browser-state" } })
    );

    await expect(getCmsSession()).rejects.toThrow();
  });
});
