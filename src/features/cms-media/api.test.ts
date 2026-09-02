import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FacebookThumbnailImportOptions,
  FacebookThumbnailProgress,
  MediaAsset
} from "./types";

const cloudflareMock = vi.hoisted(() => ({
  deleteMediaMetadataFromCloudflare: vi.fn(),
  saveMediaMetadataToCloudflare: vi.fn()
}));

const bridgeCacheMock = vi.hoisted(() => ({
  cacheBridgeMediaAsset: vi.fn(),
  removeBridgeMediaAsset: vi.fn()
}));

const facebookThumbnailMock = vi.hoisted(() => ({
  importFacebookThumbnailFromBridge: vi.fn()
}));

const mediaBridgeMock = vi.hoisted(() => ({
  deleteMediaAssetFromBridge: vi.fn(),
  saveMediaAssetToBridge: vi.fn(),
  uploadMediaAssetToBridge: vi.fn()
}));

vi.mock("../admin-write/cloudflareApi", () => cloudflareMock);
vi.mock("./bridgeCache", () => bridgeCacheMock);
vi.mock("./facebookThumbnailClient", () => facebookThumbnailMock);
vi.mock("./mediaBridgeClient", () => mediaBridgeMock);

import { importFacebookThumbnailAsset } from "./api";

const thumbnailAsset: MediaAsset = {
  id: "facebook-thumbnail-test",
  name: "Facebook - ข่าวทดสอบ",
  type: "image",
  size: "12 KB",
  owner: "facebook-import",
  driveUrl: "https://drive.google.com/file/d/test/view",
  updatedAt: "2026-09-02T00:00:00.000Z"
};

describe("Facebook thumbnail media progress", () => {
  beforeEach(() => {
    cloudflareMock.saveMediaMetadataToCloudflare.mockReset();
    cloudflareMock.saveMediaMetadataToCloudflare.mockImplementation(async (asset: MediaAsset) => asset);
    bridgeCacheMock.cacheBridgeMediaAsset.mockReset();
    bridgeCacheMock.cacheBridgeMediaAsset.mockImplementation((asset: MediaAsset) => asset);
    facebookThumbnailMock.importFacebookThumbnailFromBridge.mockReset();
    facebookThumbnailMock.importFacebookThumbnailFromBridge.mockImplementation(
      async (_input: unknown, options?: FacebookThumbnailImportOptions) => {
        options?.onProgress?.({ phase: "requesting", attempt: 1, totalAttempts: 2 });
        options?.onProgress?.({ phase: "received", attempt: 1, totalAttempts: 2 });
        return thumbnailAsset;
      }
    );
  });

  it("reports persistence after the bridge has returned the thumbnail", async () => {
    const progress: FacebookThumbnailProgress[] = [];

    const saved = await importFacebookThumbnailAsset(
      {
        sourceUrl: "https://www.facebook.com/example/posts/123",
        name: thumbnailAsset.name,
        owner: thumbnailAsset.owner
      },
      { onProgress: (value) => progress.push(value) }
    );

    expect(saved).toEqual(thumbnailAsset);
    expect(cloudflareMock.saveMediaMetadataToCloudflare).toHaveBeenCalledWith(thumbnailAsset);
    expect(progress).toEqual([
      { phase: "requesting", attempt: 1, totalAttempts: 2 },
      { phase: "received", attempt: 1, totalAttempts: 2 },
      { phase: "persisting" },
      { phase: "persisted" }
    ]);
  });
});
