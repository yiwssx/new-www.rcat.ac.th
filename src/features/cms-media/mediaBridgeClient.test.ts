import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkMediaBridgeStatus,
  deleteMediaAssetFromBridge,
  getBase64DecodedByteLength,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_UPLOAD_CHUNK_BYTES,
  saveMediaAssetToBridge,
  splitBase64IntoUploadChunks,
  uploadMediaAssetToBridge
} from "./mediaBridgeClient";

const uploadedAsset = {
  id: "media-original-1",
  name: "original-photo.jpg",
  type: "image" as const,
  size: "10 MB",
  owner: "editor",
  driveUrl: "https://drive.google.com/file/d/original-file/view",
  fileId: "original-file",
  mimeType: "image/jpeg",
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

  it("calculates decoded bytes and creates range-safe chunks without decoding the whole file", () => {
    const base64 = "data:application/pdf;base64,AAECAwQF\nBgcICQo=";

    expect(getBase64DecodedByteLength(base64)).toBe(11);
    expect(splitBase64IntoUploadChunks(base64, 6)).toEqual([
      { chunkBase64: "AAECAwQF", startByte: 0, endByte: 5 },
      { chunkBase64: "BgcICQo=", startByte: 6, endByte: 10 }
    ]);
    expect(() => getBase64DecodedByteLength("abc===")).toThrow("ข้อมูลไฟล์ Base64 ไม่ถูกต้อง");
  });

  it("uploads an original file through start and sequential chunk requests", async () => {
    const bytes = Buffer.alloc(MEDIA_UPLOAD_CHUNK_BYTES + 2, 7);
    const fileBase64 = bytes.toString("base64");
    const requests: Array<{ resource: string; payload: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      requests.push(request);

      if (request.resource === "startMediaUpload") {
        return Response.json({
          uploadUrl: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-session",
          totalBytes: bytes.length,
          chunkSizeBytes: MEDIA_UPLOAD_CHUNK_BYTES
        });
      }

      const endByte = Number(request.payload.endByte);
      if (endByte + 1 < bytes.length) {
        return Response.json({ uploadComplete: false, nextByte: endByte + 1 });
      }

      return Response.json({ uploadComplete: true, asset: uploadedAsset });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge({
        name: uploadedAsset.name,
        type: uploadedAsset.type,
        size: uploadedAsset.size,
        owner: uploadedAsset.owner,
        fileName: uploadedAsset.name,
        fileBase64,
        mimeType: uploadedAsset.mimeType
      })
    ).resolves.toEqual(uploadedAsset);

    expect(requests.map((request) => request.resource)).toEqual([
      "startMediaUpload",
      "uploadMediaChunk",
      "uploadMediaChunk"
    ]);
    expect(requests[0].payload).not.toHaveProperty("fileBase64");
    expect(requests[1].payload).toMatchObject({ startByte: 0, endByte: MEDIA_UPLOAD_CHUNK_BYTES - 1 });
    expect(requests[2].payload).toMatchObject({
      startByte: MEDIA_UPLOAD_CHUNK_BYTES,
      endByte: MEDIA_UPLOAD_CHUNK_BYTES + 1
    });
    expect(String(requests[1].payload.chunkBase64).length).toBe((MEDIA_UPLOAD_CHUNK_BYTES / 3) * 4);
    expect(JSON.stringify(requests)).not.toContain("fileBase64");
  });

  it("rejects invalid and over-limit upload data before starting a session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge({
        name: "bad.pdf",
        type: "document",
        owner: "editor",
        fileName: "bad.pdf",
        mimeType: "application/pdf",
        fileBase64: "not-base64"
      })
    ).rejects.toThrow("ข้อมูลไฟล์ Base64 ไม่ถูกต้อง");

    const tooLarge = Buffer.alloc(MAX_MEDIA_UPLOAD_BYTES + 1).toString("base64");
    await expect(
      saveMediaAssetToBridge({
        name: "large.pdf",
        type: "document",
        owner: "editor",
        fileName: "large.pdf",
        mimeType: "application/pdf",
        fileBase64: tooLarge
      })
    ).rejects.toThrow("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps proxy payload-limit and invalid non-JSON responses to safe Thai errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("FUNCTION_PAYLOAD_TOO_LARGE", { status: 413 }))
      .mockResolvedValueOnce(new Response("<html>bad gateway with secrets</html>", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadMediaAssetToBridge(uploadedAsset)).rejects.toThrow(
      "ไฟล์มีขนาดใหญ่เกินขีดจำกัดของช่องทางอัปโหลด"
    );
    await expect(uploadMediaAssetToBridge(uploadedAsset)).rejects.toThrow(
      "ระบบอัปโหลดสื่อได้รับการตอบกลับที่ไม่ถูกต้อง (HTTP 502)"
    );
  });

  it("honors an embedded Apps Script status code without exposing an upload session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          error:
            "failed https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=secret-session",
          statusCode: 410
        })
      )
    );

    await expect(uploadMediaAssetToBridge(uploadedAsset)).rejects.toThrow(
      "ระบบอัปโหลดสื่อได้รับการตอบกลับที่ไม่ถูกต้อง (HTTP 200)"
    );
  });

  it("uploads existing media bridge assets through the legacy media resource", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(uploadedAsset));
    vi.stubGlobal("fetch", fetchMock);

    await uploadMediaAssetToBridge(uploadedAsset);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ resource: "media" });
  });

  it("keeps metadata-only saves on the media resource", async () => {
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

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      resource: "deleteMedia",
      payload: { id: uploadedAsset.id, fileId: uploadedAsset.fileId, deleteDriveFile: true }
    });
  });
});
