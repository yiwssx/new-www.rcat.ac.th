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

beforeEach(() => {
  governanceMock.getMediaUsage.mockReset();
  adminWriteMock.deleteMediaMetadataFromCloudflare.mockReset();
  bridgeMock.deleteMediaAssetFromBridge.mockReset();
  cacheMock.removeBridgeMediaAsset.mockReset();
  adminWriteMock.deleteMediaMetadataFromCloudflare.mockResolvedValue({ id: asset.id, deleted: true });
  bridgeMock.deleteMediaAssetFromBridge.mockResolvedValue({ id: asset.id, deleted: true });
});

describe("media deletion governance", () => {
  it("blocks an in-use CMS asset before touching the Drive bridge", async () => {
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
    expect(bridgeMock.deleteMediaAssetFromBridge).not.toHaveBeenCalled();
    expect(adminWriteMock.deleteMediaMetadataFromCloudflare).not.toHaveBeenCalled();
    expect(cacheMock.removeBridgeMediaAsset).not.toHaveBeenCalled();
  });

  it("deletes an unused CMS asset only after the usage preflight passes", async () => {
    governanceMock.getMediaUsage.mockResolvedValue({
      mediaId: asset.id,
      name: asset.name,
      altText: "",
      count: 0,
      items: []
    });

    await expect(deleteMediaAsset(asset)).resolves.toEqual({ id: asset.id, deleted: true });
    expect(governanceMock.getMediaUsage).toHaveBeenCalledWith(asset.id);
    expect(bridgeMock.deleteMediaAssetFromBridge).toHaveBeenCalledWith(asset);
    expect(adminWriteMock.deleteMediaMetadataFromCloudflare).toHaveBeenCalledWith(asset.id);
    expect(cacheMock.removeBridgeMediaAsset).toHaveBeenCalledWith(asset.id);
  });

  it("keeps legacy id-only cleanup transport-compatible while Worker protection remains authoritative", async () => {
    await expect(deleteMediaAsset(asset.id)).resolves.toEqual({ id: asset.id, deleted: true });
    expect(governanceMock.getMediaUsage).not.toHaveBeenCalled();
    expect(bridgeMock.deleteMediaAssetFromBridge).toHaveBeenCalledWith(asset.id);
    expect(adminWriteMock.deleteMediaMetadataFromCloudflare).toHaveBeenCalledWith(asset.id);
  });
});
