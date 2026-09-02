import { afterEach, describe, expect, it, vi } from "vitest";
import type { FacebookThumbnailProgress, MediaAsset } from "./types";

const { readCmsCsrfToken, notifyCmsSessionExpired } = vi.hoisted(() => ({
  readCmsCsrfToken: vi.fn(() => "csrf-token"),
  notifyCmsSessionExpired: vi.fn()
}));

vi.mock("../cms-auth", () => ({
  CMS_CSRF_HEADER_NAME: "x-cms-csrf",
  CMS_SESSION_EXPIRED_MESSAGE: "session expired",
  CmsAuthError: class CmsAuthError extends Error {
    status: number;

    constructor(status: number, options?: { message?: string }) {
      super(options?.message);
      this.status = status;
    }
  },
  notifyCmsSessionExpired,
  readCmsCsrfToken
}));

import { importFacebookThumbnailFromBridge } from "./facebookThumbnailClient";

const asset: MediaAsset = {
  id: "facebook-thumbnail-test",
  name: "Facebook - ข่าวทดสอบ",
  type: "image",
  size: "4 B",
  owner: "facebook-import",
  driveUrl: "https://drive.google.com/file/d/test/view",
  fileId: "test",
  mimeType: "image/jpeg",
  thumbnailUrl: "https://drive.google.com/thumbnail?id=test&sz=w1200",
  previewUrl: "https://drive.google.com/thumbnail?id=test&sz=w1200",
  embedUrl: "https://drive.google.com/file/d/test/preview",
  updatedAt: "2026-08-31T00:00:00.000Z"
};

afterEach(() => {
  vi.restoreAllMocks();
  readCmsCsrfToken.mockReturnValue("csrf-token");
  notifyCmsSessionExpired.mockClear();
});

describe("Facebook thumbnail client fallback", () => {
  it("retries a persistent 422 preview failure through the mobile Facebook URL", async () => {
    const progress: FacebookThumbnailProgress[] = [];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ error: "Unable to create Facebook thumbnail" }, { status: 422 }))
      .mockResolvedValueOnce(Response.json(asset));

    const result = await importFacebookThumbnailFromBridge(
      {
        sourceUrl: "https://www.facebook.com/example/posts/123?ref=share",
        name: "Facebook - ข่าวทดสอบ",
        owner: "facebook-import"
      },
      { onProgress: (value) => progress.push(value) }
    );

    expect(result).toEqual(asset);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstRequest.payload.sourceUrl).toBe("https://www.facebook.com/example/posts/123?ref=share");
    expect(secondRequest.payload.sourceUrl).toBe("https://m.facebook.com/example/posts/123?ref=share");
    expect(progress).toEqual([
      { phase: "requesting", attempt: 1, totalAttempts: 2 },
      { phase: "retrying", attempt: 1, totalAttempts: 2 },
      { phase: "requesting", attempt: 2, totalAttempts: 2 },
      { phase: "received", attempt: 2, totalAttempts: 2 }
    ]);
  });

  it("falls back to the legacy permalink representation for numeric page post URLs", async () => {
    const progress: FacebookThumbnailProgress[] = [];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ error: "Unable to create Facebook thumbnail" }, { status: 422 }))
      .mockResolvedValueOnce(Response.json({ error: "Unable to create Facebook thumbnail" }, { status: 422 }))
      .mockResolvedValueOnce(Response.json(asset));

    const result = await importFacebookThumbnailFromBridge(
      {
        sourceUrl: "https://www.facebook.com/1609435494524655/posts/709909317810615",
        name: "Facebook - ข่าวทดสอบ",
        owner: "facebook-import"
      },
      { onProgress: (value) => progress.push(value) }
    );

    expect(result).toEqual(asset);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const thirdRequest = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(thirdRequest.payload.sourceUrl).toBe(
      "https://www.facebook.com/permalink.php?story_fbid=709909317810615&id=1609435494524655"
    );
    expect(progress).toEqual([
      { phase: "requesting", attempt: 1, totalAttempts: 4 },
      { phase: "retrying", attempt: 1, totalAttempts: 4 },
      { phase: "requesting", attempt: 2, totalAttempts: 4 },
      { phase: "retrying", attempt: 2, totalAttempts: 4 },
      { phase: "requesting", attempt: 3, totalAttempts: 4 },
      { phase: "received", attempt: 3, totalAttempts: 4 }
    ]);
  });

  it("does not retry unrelated bridge failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ error: "Apps Script bridge failed" }, { status: 502 }));

    await expect(
      importFacebookThumbnailFromBridge({
        sourceUrl: "https://www.facebook.com/example/posts/123",
        name: "Facebook - ข่าวทดสอบ",
        owner: "facebook-import"
      })
    ).rejects.toThrow("Apps Script bridge failed");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
