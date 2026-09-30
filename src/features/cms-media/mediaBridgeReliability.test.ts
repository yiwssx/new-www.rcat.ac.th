import { describe, expect, it, vi } from "vitest";

const { readCmsCsrfToken } = vi.hoisted(() => ({
  readCmsCsrfToken: vi.fn(() => "csrf-token")
}));

vi.mock("../cms-auth", () => ({
  CMS_CSRF_HEADER_NAME: "x-cms-csrf",
  CMS_SESSION_EXPIRED_MESSAGE: "session expired",
  CmsAuthError: class CmsAuthError extends Error {
    constructor(readonly status: number) {
      super(`CMS auth error ${status}`);
    }
  },
  notifyCmsSessionExpired: vi.fn(),
  readCmsCsrfToken
}));

import { MEDIA_UPLOAD_CHUNK_BYTES, saveMediaAssetToBridge } from "./mediaBridgeClient";

const uploadedAsset = {
  id: "media-recovered-1",
  name: "recovered.jpg",
  type: "image" as const,
  size: "3 B",
  owner: "editor",
  driveUrl: "https://drive.google.com/file/d/recovered/view",
  fileId: "recovered",
  mimeType: "image/jpeg",
  updatedAt: "2026-10-01T00:00:00+07:00"
};

function parseRequest(init?: RequestInit) {
  return JSON.parse(String(init?.body)) as {
    resource: string;
    payload: Record<string, unknown>;
  };
}

describe("resumable media bridge reliability", () => {
  it("survives more transient start failures than the previous two-retry window", async () => {
    const delay = vi.fn(async () => undefined);
    let startCalls = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseRequest(init);
      if (request.resource === "startMediaUpload") {
        startCalls += 1;
        if (startCalls <= 3) {
          return Response.json({ error: "Apps Script bridge failed" }, { status: 502 });
        }
        return Response.json({
          uploadComplete: false,
          uploadUrl:
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=reliability-test",
          totalBytes: 3,
          chunkSizeBytes: MEDIA_UPLOAD_CHUNK_BYTES,
          nextByte: 0
        });
      }

      if (request.resource === "uploadMediaChunk") {
        return Response.json({ uploadComplete: true, asset: uploadedAsset });
      }

      throw new Error(`Unexpected resource: ${request.resource}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveMediaAssetToBridge(
        {
          name: uploadedAsset.name,
          type: "image",
          owner: uploadedAsset.owner,
          fileName: uploadedAsset.name,
          mimeType: uploadedAsset.mimeType,
          fileBase64: "AQID"
        },
        {
          createUploadKey: () => "reliability-upload-key-0001",
          delay,
          random: () => 0.5
        }
      )
    ).resolves.toEqual(uploadedAsset);

    expect(startCalls).toBe(4);
    expect(delay.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([500, 1000, 2000]);
  });
});