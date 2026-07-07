import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkMediaBridgeStatus,
  deleteMediaAssetFromBridge,
  saveMediaAssetToBridge,
  uploadMediaAssetToBridge
} from "./mediaBridgeClient";

const originalFileBase64 = "AAECAwQFBgcICQoLDA0ODw==";
const uploadedAsset = {
  id: "media-original-1",
  name: "original-photo.jpg",
  type: "image" as const,
  size: "10 MB",
  owner: "editor",
  driveUrl: "https://drive.google.com/file/d/original-file/view",
  fileId: "original-file",
  mimeType: "image/jpeg",
  fileBase64: originalFileBase64,
  updatedAt: "2026-06-21T10:00:00+07:00"
};

describe("same-origin Apps Script media bridge client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("checks server-proxy bridge readiness without requiring a browser Apps Script URL", async () => {
    const status = {
      mode: "server-proxy" as const,
      configured: true,
      appsScriptUrlConfigured: true,
      bridgeTokenConfigured: true
    };
    const fetchMock = vi.fn(async () => Response.json(status));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkMediaBridgeStatus()).resolves.toEqual(status);
    expect(fetchMock).toHaveBeenCalledWith("/api/apps-script-proxy", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin"
    });
  });

  it("saves an uploaded original file through the same-origin proxy without changing base64 or size", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(uploadedAsset));
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem(
      "rcat.cms.session",
      JSON.stringify({
        user: {
          id: "admin-proxy:admin@example.test",
          email: "admin@example.test",
          name: "Admin",
          role: "admin"
        },
        token: "admin-proxy.local.test-marker-token",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      })
    );

    await expect(
      saveMediaAssetToBridge({
        name: uploadedAsset.name,
        type: uploadedAsset.type,
        size: uploadedAsset.size,
        owner: uploadedAsset.owner,
        fileName: uploadedAsset.name,
        fileBase64: originalFileBase64,
        mimeType: uploadedAsset.mimeType
      })
    ).resolves.toEqual(uploadedAsset);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apps-script-proxy");
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(requestBody).toMatchObject({
      resource: "media",
      payload: {
        fileBase64: originalFileBase64,
        size: "10 MB"
      }
    });
    expect(JSON.stringify(requestBody)).not.toContain("script.google.com");
    expect(requestBody.payload.authToken).toBeUndefined();
  });

  it("uploads existing media bridge assets through the same-origin proxy", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(uploadedAsset));
    vi.stubGlobal("fetch", fetchMock);

    await uploadMediaAssetToBridge(uploadedAsset);

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ resource: "media" });
  });

  it("saves media metadata through the media resource", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(uploadedAsset));
    vi.stubGlobal("fetch", fetchMock);

    await saveMediaAssetToBridge({
      name: uploadedAsset.name,
      type: uploadedAsset.type,
      size: uploadedAsset.size,
      owner: uploadedAsset.owner,
      driveUrl: uploadedAsset.driveUrl
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ resource: "media" });
  });

  it("deletes media through the same-origin proxy with the Drive file id", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ id: uploadedAsset.id, deleted: true })
    );
    vi.stubGlobal("fetch", fetchMock);

    await deleteMediaAssetFromBridge(uploadedAsset);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/apps-script-proxy");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      resource: "deleteMedia",
      payload: { id: uploadedAsset.id, fileId: uploadedAsset.fileId, deleteDriveFile: true }
    });
  });
});
