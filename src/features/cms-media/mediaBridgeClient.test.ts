import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CMS_CSRF_COOKIE_NAME,
  CMS_CSRF_HEADER_NAME,
  CMS_SESSION_EXPIRED_EVENT,
  CMS_SESSION_EXPIRED_MESSAGE,
  CMS_SESSION_NOTICE_KEY
} from "../cms-auth";
import type { MediaAssetInput } from "./types";
import {
  checkMediaBridgeStatus,
  deleteMediaAssetFromBridge,
  getBase64DecodedByteLength,
  isExpiredMediaUploadSessionError,
  isTransientMediaBridgeError,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_UPLOAD_CHUNK_BYTES,
  MediaBridgeRequestError,
  saveMediaAssetToBridge,
  sliceBase64ByByteRange,
  splitBase64IntoUploadChunks,
  uploadMediaAssetToBridge
} from "./mediaBridgeClient";

const TEST_UPLOAD_KEY = "test-upload-key-0001";
const CMS_CSRF_TOKEN = "C".repeat(43);
const FIRST_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-session-one";
const SECOND_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-session-two";

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

interface BridgeRequest {
  resource: string;
  payload: Record<string, unknown>;
}

function createFileInput(fileBase64: string, overrides: Partial<MediaAssetInput> = {}): MediaAssetInput {
  return {
    name: uploadedAsset.name,
    type: uploadedAsset.type,
    size: uploadedAsset.size,
    owner: uploadedAsset.owner,
    fileName: uploadedAsset.name,
    fileBase64,
    mimeType: uploadedAsset.mimeType,
    ...overrides
  };
}

function createRecoveryOptions(createUploadKey = vi.fn(() => TEST_UPLOAD_KEY)) {
  return {
    createUploadKey,
    delay: vi.fn(async () => undefined),
    random: () => 0.5
  };
}

function startIncomplete(totalBytes: number, uploadUrl = FIRST_UPLOAD_URL, nextByte = 0) {
  return {
    uploadComplete: false,
    uploadUrl,
    totalBytes,
    chunkSizeBytes: MEDIA_UPLOAD_CHUNK_BYTES,
    nextByte
  };
}

function expiredResponse() {
  return Response.json({
    error: "Media upload session expired. Please retry the upload.",
    statusCode: 410,
    code: "MEDIA_UPLOAD_SESSION_EXPIRED"
  });
}

function transientResponse(statusCode = 503) {
  return Response.json({
    error: "Drive media upload is temporarily unavailable.",
    statusCode,
    code: "DRIVE_UPLOAD_TRANSIENT"
  });
}

function parseBridgeRequest(init?: RequestInit): BridgeRequest {
  return JSON.parse(String(init?.body)) as BridgeRequest;
}

describe("Base64 media upload helpers", () => {
  it("calculates decoded bytes and creates range-safe chunks without decoding the whole file", () => {
    const base64 = "data:application/pdf;base64,AAECAwQF\nBgcICQo=";

    expect(getBase64DecodedByteLength(base64)).toBe(11);
    expect(splitBase64IntoUploadChunks(base64, 6)).toEqual([
      { chunkBase64: "AAECAwQF", startByte: 0, endByte: 5 },
      { chunkBase64: "BgcICQo=", startByte: 6, endByte: 10 }
    ]);
    expect(() => getBase64DecodedByteLength("abc===")).toThrow("ข้อมูลไฟล์ Base64 ไม่ถูกต้อง");
  });

  it.each([
    ["full range", 0, 13],
    ["first byte", 0, 1],
    ["middle range", 4, 9],
    ["final byte", 12, 13],
    ["start divisible by three", 3, 8],
    ["start not divisible by three", 2, 8],
    ["end not divisible by three", 3, 7],
    ["range spanning chunk boundaries", 2, 11]
  ])("slices the exact bytes for %s", (_label, startByte, endByteExclusive) => {
    const bytes = Buffer.from(Array.from({ length: 13 }, (_value, index) => index));
    const sliced = sliceBase64ByByteRange(bytes.toString("base64"), startByte as number, endByteExclusive as number);

    expect(Buffer.from(sliced, "base64")).toEqual(bytes.subarray(startByte as number, endByteExclusive as number));
  });

  it("supports an empty range and rejects invalid byte indexes", () => {
    const base64 = Buffer.from([0, 1, 2, 3, 4]).toString("base64");

    expect(sliceBase64ByByteRange(base64, 2, 2)).toBe("");
    expect(() => sliceBase64ByByteRange(base64, -1, 2)).toThrow("ช่วงข้อมูลไฟล์สำหรับอัปโหลดไม่ถูกต้อง");
    expect(() => sliceBase64ByByteRange(base64, 3, 2)).toThrow("ช่วงข้อมูลไฟล์สำหรับอัปโหลดไม่ถูกต้อง");
    expect(() => sliceBase64ByByteRange(base64, 0, 6)).toThrow("ช่วงข้อมูลไฟล์สำหรับอัปโหลดไม่ถูกต้อง");
  });
});

describe("same-origin Apps Script media bridge client", () => {
  beforeEach(() => {
    vi.spyOn(Document.prototype, "cookie", "get").mockReturnValue(`${CMS_CSRF_COOKIE_NAME}=${CMS_CSRF_TOKEN}`);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("checks finite server-proxy bridge readiness with the HttpOnly CMS cookie flow", async () => {
    const status = {
      mode: "server-proxy" as const,
      appsScriptBridge: "connected" as const,
      driveStorage: "connected" as const
    };
    const fetchMock = vi.fn(async () => Response.json(status));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkMediaBridgeStatus()).resolves.toEqual(status);
    expect(fetchMock).toHaveBeenCalledWith("/api/apps-script-proxy", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include"
    });
  });

  it("invokes global CMS Session-expiry handling only for a real 401", async () => {
    const sessionExpiredListener = vi.fn();
    window.addEventListener(CMS_SESSION_EXPIRED_EVENT, sessionExpiredListener);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "CMS session is invalid or expired" }, { status: 401 }))
    );

    await expect(checkMediaBridgeStatus()).rejects.toMatchObject({
      httpStatus: 401,
      message: CMS_SESSION_EXPIRED_MESSAGE
    });
    expect(sessionExpiredListener).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CMS_SESSION_NOTICE_KEY)).toBe(CMS_SESSION_EXPIRED_MESSAGE);
    window.removeEventListener(CMS_SESSION_EXPIRED_EVENT, sessionExpiredListener);
  });

  it("does not expire the CMS Session for a 503 bridge failure", async () => {
    const sessionExpiredListener = vi.fn();
    window.addEventListener(CMS_SESSION_EXPIRED_EVENT, sessionExpiredListener);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Apps Script bridge is unavailable" }, { status: 503 }))
    );

    await expect(checkMediaBridgeStatus()).rejects.toMatchObject({ httpStatus: 503 });
    expect(sessionExpiredListener).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(CMS_SESSION_NOTICE_KEY)).toBeNull();
    window.removeEventListener(CMS_SESSION_EXPIRED_EVENT, sessionExpiredListener);
  });

  it("uses one stable upload key across start and sequential chunks", async () => {
    const bytes = Buffer.alloc(MEDIA_UPLOAD_CHUNK_BYTES + 2, 7);
    const requests: BridgeRequest[] = [];
    const createUploadKey = vi.fn(() => TEST_UPLOAD_KEY);
    const onProgress = vi.fn();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      requests.push(request);

      if (request.resource === "startMediaUpload") {
        return Response.json(startIncomplete(bytes.length));
      }

      const endByte = Number(request.payload.endByte);
      if (endByte + 1 < bytes.length) {
        return Response.json({ uploadComplete: false, nextByte: endByte + 1 });
      }

      return Response.json({ uploadComplete: true, asset: { ...uploadedAsset, uploadKey: TEST_UPLOAD_KEY } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(bytes.toString("base64")), {
        ...createRecoveryOptions(createUploadKey),
        onProgress
      })
    ).resolves.toEqual(uploadedAsset);

    expect(createUploadKey).toHaveBeenCalledTimes(1);
    expect(requests.map((request) => request.resource)).toEqual([
      "startMediaUpload",
      "uploadMediaChunk",
      "uploadMediaChunk"
    ]);
    expect(requests.every((request) => request.payload.uploadKey === TEST_UPLOAD_KEY)).toBe(true);
    expect(requests[0].payload).not.toHaveProperty("fileBase64");
    expect(requests[1].payload).toMatchObject({ startByte: 0, endByte: MEDIA_UPLOAD_CHUNK_BYTES - 1 });
    expect(requests[2].payload).toMatchObject({
      startByte: MEDIA_UPLOAD_CHUNK_BYTES,
      endByte: MEDIA_UPLOAD_CHUNK_BYTES + 1
    });
    expect(JSON.stringify(requests)).not.toContain("fileBase64");
    expect(onProgress.mock.calls.map(([progress]) => progress.uploadedBytes)).toEqual([
      0,
      MEDIA_UPLOAD_CHUNK_BYTES,
      bytes.length
    ]);
    expect(onProgress.mock.calls.at(-1)?.[0]).toEqual({
      uploadedBytes: bytes.length,
      totalBytes: bytes.length,
      percent: 100
    });
  });

  it("queries status before resending after a network failure", async () => {
    const bytes = Buffer.from([0, 1, 2, 3, 4, 5]);
    const requests: BridgeRequest[] = [];
    let chunkAttempts = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      requests.push(request);
      if (request.resource === "startMediaUpload") {
        return Response.json(startIncomplete(bytes.length));
      }
      if (request.resource === "queryMediaUploadStatus") {
        expect(request.payload).not.toHaveProperty("fileBase64");
        expect(request.payload).not.toHaveProperty("chunkBase64");
        return Response.json({ uploadComplete: false, nextByte: 0 });
      }
      chunkAttempts += 1;
      if (chunkAttempts === 1) {
        throw new TypeError("network failed");
      }
      return Response.json({ uploadComplete: true, asset: uploadedAsset });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(bytes.toString("base64")), createRecoveryOptions())
    ).resolves.toEqual(uploadedAsset);
    expect(requests.map((request) => request.resource)).toEqual([
      "startMediaUpload",
      "uploadMediaChunk",
      "queryMediaUploadStatus",
      "uploadMediaChunk"
    ]);
    expect(chunkAttempts).toBe(2);
  });

  it("resumes at a partially acknowledged byte without resending or skipping bytes", async () => {
    const bytes = Buffer.from(Array.from({ length: 17 }, (_value, index) => index));
    const requests: BridgeRequest[] = [];
    let chunkAttempts = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      requests.push(request);
      if (request.resource === "startMediaUpload") {
        return Response.json(startIncomplete(bytes.length));
      }
      if (request.resource === "queryMediaUploadStatus") {
        return Response.json({ uploadComplete: false, nextByte: 5 });
      }
      chunkAttempts += 1;
      if (chunkAttempts === 1) {
        throw new TypeError("response lost after partial acceptance");
      }
      return Response.json({ uploadComplete: true, asset: uploadedAsset });
    });
    vi.stubGlobal("fetch", fetchMock);

    await saveMediaAssetToBridge(createFileInput(bytes.toString("base64")), createRecoveryOptions());

    const chunkRequests = requests.filter((request) => request.resource === "uploadMediaChunk");
    expect(chunkRequests[1].payload).toMatchObject({ startByte: 5, endByte: bytes.length - 1 });
    expect(Buffer.from(String(chunkRequests[1].payload.chunkBase64), "base64")).toEqual(bytes.subarray(5));
  });

  it("recovers an ambiguously completed final chunk through status without starting again", async () => {
    const requests: BridgeRequest[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      requests.push(request);
      if (request.resource === "startMediaUpload") {
        return Response.json(startIncomplete(3));
      }
      if (request.resource === "uploadMediaChunk") {
        throw new TypeError("final response lost");
      }
      return Response.json({ uploadComplete: true, asset: uploadedAsset });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), createRecoveryOptions())
    ).resolves.toEqual(uploadedAsset);
    expect(requests.map((request) => request.resource)).toEqual([
      "startMediaUpload",
      "uploadMediaChunk",
      "queryMediaUploadStatus"
    ]);
  });

  it("returns an existing file when an expired session restarts with the same key", async () => {
    const requests: BridgeRequest[] = [];
    let startCalls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      requests.push(request);
      if (request.resource === "startMediaUpload") {
        startCalls += 1;
        return Response.json(
          startCalls === 1
            ? startIncomplete(3)
            : { uploadComplete: true, asset: { ...uploadedAsset, uploadKey: TEST_UPLOAD_KEY } }
        );
      }
      return expiredResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), createRecoveryOptions())
    ).resolves.toEqual(uploadedAsset);
    expect(startCalls).toBe(2);
    expect(requests.every((request) => request.payload.uploadKey === TEST_UPLOAD_KEY)).toBe(true);
  });

  it("restarts an expired session once and resumes with the same key", async () => {
    const requests: BridgeRequest[] = [];
    let startCalls = 0;
    let chunkCalls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      requests.push(request);
      if (request.resource === "startMediaUpload") {
        startCalls += 1;
        return Response.json(startIncomplete(3, startCalls === 1 ? FIRST_UPLOAD_URL : SECOND_UPLOAD_URL));
      }
      chunkCalls += 1;
      return chunkCalls === 1 ? expiredResponse() : Response.json({ uploadComplete: true, asset: uploadedAsset });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), createRecoveryOptions())
    ).resolves.toEqual(uploadedAsset);
    expect(startCalls).toBe(2);
    expect(chunkCalls).toBe(2);
    expect(requests.every((request) => request.payload.uploadKey === TEST_UPLOAD_KEY)).toBe(true);
  });

  it("stops after a second session expiration without another restart", async () => {
    let startCalls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      if (request.resource === "startMediaUpload") {
        startCalls += 1;
        return Response.json(startIncomplete(3, startCalls === 1 ? FIRST_UPLOAD_URL : SECOND_UPLOAD_URL));
      }
      return expiredResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), createRecoveryOptions())
    ).rejects.toThrow("เซสชันอัปโหลดหมดอายุและไม่สามารถเริ่มใหม่ได้");
    expect(startCalls).toBe(2);
  });

  it("stops after three status cycles without acknowledged progress", async () => {
    const resources: string[] = [];
    const options = createRecoveryOptions();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      resources.push(request.resource);
      if (request.resource === "startMediaUpload") {
        return Response.json(startIncomplete(3, FIRST_UPLOAD_URL, 3));
      }
      return Response.json({ uploadComplete: false, nextByte: 3 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), options)
    ).rejects.toThrow("การอัปโหลดไม่คืบหน้า");
    expect(resources).toEqual([
      "startMediaUpload",
      "queryMediaUploadStatus",
      "queryMediaUploadStatus",
      "queryMediaUploadStatus"
    ]);
    expect(options.delay).toHaveBeenCalledTimes(2);
  });

  it("retries a transient status request at most twice after the initial attempt", async () => {
    let statusCalls = 0;
    const options = createRecoveryOptions();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      if (request.resource === "startMediaUpload") {
        return Response.json(startIncomplete(3));
      }
      if (request.resource === "uploadMediaChunk") {
        throw new TypeError("network failure");
      }
      statusCalls += 1;
      return transientResponse(503);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), options)
    ).rejects.toThrow("Drive media upload is temporarily unavailable.");
    expect(statusCalls).toBe(3);
    expect(options.delay).toHaveBeenCalledTimes(2);
  });

  it("resends an unacknowledged chunk at most twice after the initial attempt", async () => {
    let chunkCalls = 0;
    let statusCalls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseBridgeRequest(init);
      if (request.resource === "startMediaUpload") {
        return Response.json(startIncomplete(3));
      }
      if (request.resource === "queryMediaUploadStatus") {
        statusCalls += 1;
        return Response.json({ uploadComplete: false, nextByte: 0 });
      }
      chunkCalls += 1;
      throw new TypeError("network failure");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), createRecoveryOptions())
    ).rejects.toThrow("ไม่สามารถอัปโหลดไฟล์ต่อได้หลังจากลองใหม่");
    expect(chunkCalls).toBe(3);
    expect(statusCalls).toBe(3);
  });

  it("rejects invalid protocol result unions without retrying", async () => {
    const fetchMock = vi.fn(async () => Response.json({ uploadComplete: false }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), createRecoveryOptions())
    ).rejects.toThrow("ระบบอัปโหลดสื่อได้รับการตอบกลับที่ไม่ถูกต้อง");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["negative next byte", { ...startIncomplete(3), nextByte: -1 }],
    ["next byte beyond total", { ...startIncomplete(3), nextByte: 4 }],
    ["mismatched total", { ...startIncomplete(3), totalBytes: 4 }],
    ["mismatched chunk size", { ...startIncomplete(3), chunkSizeBytes: 256 * 1024 }],
    ["complete without asset", { uploadComplete: true }]
  ])("rejects %s in a start result", async (_label, result) => {
    const fetchMock = vi.fn(async () => Response.json(result));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1, 2, 3]).toString("base64")), createRecoveryOptions())
    ).rejects.toThrow("ระบบอัปโหลดสื่อได้รับการตอบกลับที่ไม่ถูกต้อง");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([408, 425, 429, 500, 502, 503, 504])("classifies HTTP %i as retryable", (status) => {
    expect(isTransientMediaBridgeError(new MediaBridgeRequestError("safe", status))).toBe(true);
    expect(isTransientMediaBridgeError(new MediaBridgeRequestError("safe", 200, status))).toBe(true);
  });

  it("classifies network, protocol, expiration, and non-retryable client errors", () => {
    expect(isTransientMediaBridgeError(new TypeError("network"))).toBe(true);
    expect(isTransientMediaBridgeError(new MediaBridgeRequestError("safe", 400, 400, "DRIVE_UPLOAD_TRANSIENT"))).toBe(
      true
    );
    expect(isTransientMediaBridgeError(new MediaBridgeRequestError("safe", 400))).toBe(false);
    expect(isTransientMediaBridgeError(new MediaBridgeRequestError("safe", 403))).toBe(false);
    expect(
      isExpiredMediaUploadSessionError(new MediaBridgeRequestError("safe", 200, 410, "MEDIA_UPLOAD_SESSION_EXPIRED"))
    ).toBe(true);
  });

  it("rejects invalid, empty, and over-limit upload data before starting a session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveMediaAssetToBridge(createFileInput("not-base64"))).rejects.toThrow("ข้อมูลไฟล์ Base64 ไม่ถูกต้อง");
    await expect(saveMediaAssetToBridge(createFileInput(""))).rejects.toThrow("ข้อมูลไฟล์ Base64 ไม่ถูกต้อง");
    const tooLarge = Buffer.alloc(MAX_MEDIA_UPLOAD_BYTES + 1).toString("base64");
    await expect(saveMediaAssetToBridge(createFileInput(tooLarge))).rejects.toThrow("ไฟล์ต้องมีขนาดไม่เกิน 100 MB");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose an upload key from a bridge error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          error: `uploadKey=${TEST_UPLOAD_KEY}`,
          statusCode: 400
        })
      )
    );

    await expect(
      saveMediaAssetToBridge(createFileInput(Buffer.from([1]).toString("base64")), createRecoveryOptions())
    ).rejects.not.toThrow(TEST_UPLOAD_KEY);
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

  it("uploads existing assets, keeps metadata saves on media, and preserves deletion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(uploadedAsset))
      .mockResolvedValueOnce(Response.json(uploadedAsset))
      .mockResolvedValueOnce(Response.json({ id: uploadedAsset.id, deleted: true }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadMediaAssetToBridge(uploadedAsset);
    await saveMediaAssetToBridge({
      name: uploadedAsset.name,
      type: uploadedAsset.type,
      size: uploadedAsset.size,
      owner: uploadedAsset.owner,
      driveUrl: uploadedAsset.driveUrl
    });
    await deleteMediaAssetFromBridge(uploadedAsset);

    const requests = fetchMock.mock.calls.map((call) => parseBridgeRequest(call[1]));
    expect(requests.map((request) => request.resource)).toEqual(["media", "media", "deleteMedia"]);
    expect(requests[2].payload).toEqual({
      id: uploadedAsset.id,
      fileId: uploadedAsset.fileId,
      deleteDriveFile: true
    });
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({
        credentials: "include",
        headers: expect.objectContaining({
          [CMS_CSRF_HEADER_NAME]: CMS_CSRF_TOKEN
        })
      });
    }
  });
});
