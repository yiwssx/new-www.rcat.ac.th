import { beforeEach, describe, expect, it } from "vitest";
import {
  cacheBridgeMediaAsset,
  clearBridgeMediaAssetsForTests,
  mergeBridgeMediaAssets,
  removeBridgeMediaAsset
} from "./bridgeCache";
import type { MediaAsset } from "./types";

const asset: MediaAsset = {
  id: "media-bridge-1",
  name: "Original upload",
  type: "image",
  size: "2 MB",
  owner: "editor",
  driveUrl: "https://files.example.test/original",
  fileId: "drive-file-1",
  mimeType: "image/png",
  previewUrl: "https://files.example.test/preview",
  updatedAt: "2026-06-21T08:30:00+07:00"
};

describe("media bridge metadata cache", () => {
  beforeEach(() => {
    clearBridgeMediaAssetsForTests();
  });

  it("keeps an uploaded bridge asset visible over a stale Cloudflare snapshot", () => {
    cacheBridgeMediaAsset(asset);

    expect(mergeBridgeMediaAssets([])).toEqual([asset]);
    expect(mergeBridgeMediaAssets([{ ...asset, name: "stale" }])).toEqual([asset]);
  });

  it("removes deleted bridge metadata", () => {
    cacheBridgeMediaAsset(asset);
    removeBridgeMediaAsset(asset.id);

    expect(mergeBridgeMediaAssets([])).toEqual([]);
  });
});
