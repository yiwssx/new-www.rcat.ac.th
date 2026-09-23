import { beforeEach, describe, expect, it, vi } from "vitest";

const governanceMock = vi.hoisted(() => ({ getMediaUsage: vi.fn() }));
const adminWriteMock = vi.hoisted(() => ({
  deleteMediaMetadataFromCloudflare: vi.fn(),
  saveMediaMetadataToCloudflare: vi.fn()
}));
const bridgeMock = vi.hoisted(() => ({
  deleteMediaAssetFromBridge: vi.fn(),
  saveMediaAssetToBridge: vi.fn(),
  uploadMediaAssetToBridge: vi.fn()
}));
const cacheMock = vi.hoisted(() => ({
  cacheBridgeMediaAsset: vi.fn((asset) => asset),
  removeBridgeMediaAsset: vi.fn()
}));

vi.mock("../cms-governance/client", () => governanceMock);
vi.mock("../admin-write/cloudflareApi", () => adminWriteMock);
vi.mock("./mediaBridgeClient", () => bridgeMock);
vi.mock("./bridgeCache", () => cacheMock);
vi.mock("./facebookThumbnailClient", () => ({ importFacebookThumbnailFromBridge: vi.fn() }));

import { deleteMediaAsset } from "./api";
import type { MediaAsset } from "./types";

const asset: MediaAsset = {
  id: "media-1",
  name: "Usage protected image",
  type: "image",
  size: "1 MB",
  owner: "editor@example.invalid",
  driveUrl: "https://drive.google.com/file/d/media-1/view",
  fileId: "media-1",
  updatedAt: "2026-09-23T00:00:00.000Z"
};

function unusedMedia() {
  return {
    mediaId: asset.id,
    name: asset.name,
    altText: "",
    count: 0,
    items: []
  };
}

beforeEach(() => {
  governanceMock.getMediaUsage.mockReset();
  adminWriteMock.deleteMediaMetadataFromCloudflare.mockReset();
  adminWriteMock.saveMediaMetadataToCloudflare.mockReset();
  bridgeMock.deleteMediaAssetFromBridge.mockReset();
  cacheMock.removeBridgeMediaAsset.mockReset();
  adminWriteMock.deleteMediaMetadataFromCloudflare.mockResolvedValue({ id: asset.id, deleted: true });
  adminWriteMock.saveMediaMetadataToCloudflare.mockResolvedValue(asset);
  bridgeMock.deleteMediaAssetFromBridge.mockResolvedValue({ id: asset.id, deleted: true });
});

describe("media deletion governance", () => {
  it("blocks an in-use CMS asset before touching metadata or the Drive bridge", async () => {
    governanceMock.getMediaUsage.mockResolvedValue({
      mediaId: asset.id,
      name: asset.name,
      altText: "",
      count: 2,
      items: [
        { entityType: "content", id: "content-1", title: "Article", detail: "news" },
        { entityType: "document", id: "document-1", title: "Document", detail: "document" }
      ]
    });

    await expect(deleteMediaAsset(asset)).rejects.toThrow("ยังถูกใช้งานอยู่ 2 จุด");
    expect(governanceMock.getMediaUsage).toHaveBeenCalledWith(asset.id);
    expect(adminWriteMock.deleteMediaMetadataFromCloudflare).not.toHaveBeenCalled();
    expect(bridgeMock.deleteMediaAssetFromBridge).not.toHaveBeenCalled();
    expect(cacheMock.removeBridgeMediaAsset).not.toHaveBeenCalled();
  });

  it("deletes guarded metadata before the destructive Drive operation", async () => {
    governanceMock.getMediaUsage.mockResolvedValue(unusedMedia());

    await expect(deleteMediaAsset(asset)).resolves.toEqual({ id: asset.id, deleted: true });
    expect(governanceMock.getMediaUsage).toHaveBeenCalledWith(asset.id);
    expect(adminWriteMock.deleteMediaMetadataFromCloudflare).toHaveBeenCalledWith(asset.id);
    expect(bridgeMock.deleteMediaAssetFromBridge).toHaveBeenCalledWith(asset);
    expect(adminWriteMock.deleteMediaMetadataFromCloudflare.mock.invocationCallOrder[0]).toBeLessThan(
      bridgeMock.deleteMediaAssetFromBridge.mock.invocationCallOrder[0]
    );
    expect(cacheMock.removeBridgeMediaAsset).toHaveBeenCalledWith(asset.id);
  });

  it("restores D1 metadata best-effort when Drive deletion fails", async () => {
    governanceMock.getMediaUsage.mockResolvedValue(unusedMedia());
    bridgeMock.deleteMediaAssetFromBridge.mockRejectedValue(new Error("Drive delete failed"));

    await expect(deleteMediaAsset(asset)).rejects.toThrow("Drive delete failed");
    expect(adminWriteMock.deleteMediaMetadataFromCloudflare).toHaveBeenCalledWith(asset.id);
    expect(adminWriteMock.saveMediaMetadataToCloudflare).toHaveBeenCalledWith(asset);
    expect(cacheMock.removeBridgeMediaAsset).not.toHaveBeenCalled();
  });

  it("keeps legacy id-only cleanup transport-compatible while Worker protection remains authoritative", async () => {
    await expect(deleteMediaAsset(asset.id)).resolves.toEqual({ id: asset.id, deleted: true });
    expect(governanceMock.getMediaUsage).not.toHaveBeenCalled();
    expect(bridgeMock.deleteMediaAssetFromBridge).toHaveBeenCalledWith(asset.id);
    expect(adminWriteMock.deleteMediaMetadataFromCloudflare).toHaveBeenCalledWith(asset.id);
  });
});
