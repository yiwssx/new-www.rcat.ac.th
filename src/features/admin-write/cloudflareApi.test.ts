import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CMS_CSRF_COOKIE_NAME,
  CMS_CSRF_HEADER_NAME,
  CmsAuthError,
  CmsStepUpCancelledError,
  cmsStepUpCoordinator
} from "../cms-auth";
import { requestCloudflareAdmin } from "./cloudflareApi";

vi.mock("../../config/adminWriteProvider", () => ({
  buildCloudflareAdminApiUrl: (path: string) => `/api/admin-proxy?path=${encodeURIComponent(path)}`,
  resolveCloudflareAdminWriteConfig: () => ({ authMode: "server-proxy", baseUrl: "/api/admin-proxy" })
}));

const csrfToken = "S".repeat(43);

describe("Cloudflare Admin CMS Session integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cmsStepUpCoordinator.resetForTests();
  });

  it("attaches exact CSRF only to same-origin mutations and preserves request headers", async () => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${csrfToken}`);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ ok: true }));

    await requestCloudflareAdmin("/api/admin/settings/site");
    await requestCloudflareAdmin("/api/admin/settings/site", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-RCAT-Expected-Revision": "4"
      },
      body: '{"name":"safe"}'
    });

    const getHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    const mutationHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(getHeaders.has(CMS_CSRF_HEADER_NAME)).toBe(false);
    expect(mutationHeaders.get(CMS_CSRF_HEADER_NAME)).toBe(csrfToken);
    expect(mutationHeaders.get("Content-Type")).toBe("application/json");
    expect(mutationHeaders.get("X-RCAT-Expected-Revision")).toBe("4");
  });

  it("fails closed before sending a mutation with malformed CSRF", async () => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=malformed`);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));

    await expect(requestCloudflareAdmin("/api/admin/menu", { method: "PUT", body: "{}" })).rejects.toBeInstanceOf(
      CmsAuthError
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens one step-up for concurrent 428 responses and retries each replayable body once", async () => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${csrfToken}`);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ error: "reauthentication required", assurance: "password" }, { status: 428 })
      )
      .mockResolvedValueOnce(
        Response.json({ error: "reauthentication required", assurance: "password" }, { status: 428 })
      )
      .mockResolvedValueOnce(Response.json({ item: { id: "one" } }))
      .mockResolvedValueOnce(Response.json({ item: { id: "two" } }));
    const first = requestCloudflareAdmin("/api/admin/users/one", {
      method: "PATCH",
      body: '{"name":"unchanged-one"}'
    });
    const second = requestCloudflareAdmin("/api/admin/users/two", {
      method: "PATCH",
      body: '{"name":"unchanged-two"}'
    });

    await vi.waitFor(() => {
      expect(cmsStepUpCoordinator.getSnapshot()).toEqual({ open: true, assurance: "password" });
    });
    cmsStepUpCoordinator.complete();

    await expect(first).resolves.toEqual({ item: { id: "one" } });
    await expect(second).resolves.toEqual({ item: { id: "two" } });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][1]?.body).toBe('{"name":"unchanged-one"}');
    expect(fetchMock.mock.calls[2][1]?.body).toBe('{"name":"unchanged-one"}');
  });

  it("does not loop when the one allowed retry also returns 428", async () => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${csrfToken}`);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ error: "reauthentication required", assurance: "mfa" }, { status: 428 }));
    const request = requestCloudflareAdmin("/api/admin/users/user-1/mfa", {
      method: "DELETE",
      body: "{}"
    });
    await vi.waitFor(() => expect(cmsStepUpCoordinator.getSnapshot().open).toBe(true));
    cmsStepUpCoordinator.complete();

    await expect(request).rejects.toMatchObject({ status: 428 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancellation performs no retry", async () => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${csrfToken}`);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ error: "reauthentication required", assurance: "password" }, { status: 428 }));
    const request = requestCloudflareAdmin("/api/admin/settings/site", {
      method: "PUT",
      body: "{}"
    });
    await vi.waitFor(() => expect(cmsStepUpCoordinator.getSnapshot().open).toBe(true));
    cmsStepUpCoordinator.cancel();

    await expect(request).rejects.toBeInstanceOf(CmsStepUpCancelledError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears CMS Session state on the exact 401 but never opens step-up for 401 or 403", async () => {
    const expiredListener = vi.fn();
    window.addEventListener("rcat:cms-session-expired", expiredListener);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ error: "CMS session is invalid or expired" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ error: "required permission is missing" }, { status: 403 }));

    await expect(requestCloudflareAdmin("/api/admin/users")).rejects.toBeInstanceOf(CmsAuthError);
    await expect(requestCloudflareAdmin("/api/admin/users")).rejects.toThrow("required permission is missing");
    expect(expiredListener).toHaveBeenCalledTimes(1);
    expect(cmsStepUpCoordinator.getSnapshot().open).toBe(false);
    window.removeEventListener("rcat:cms-session-expired", expiredListener);
  });
});
