import type { MediaAsset } from "./types";

const BRIDGE_MEDIA_CACHE_KEY = "rcat.cms.media.bridge.metadata.v1";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getBridgeMediaAssets(): MediaAsset[] {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(storage.getItem(BRIDGE_MEDIA_CACHE_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as MediaAsset[]).filter((asset) => Boolean(asset?.id)) : [];
  } catch {
    return [];
  }
}

function writeBridgeMediaAssets(assets: MediaAsset[]) {
  try {
    getStorage()?.setItem(BRIDGE_MEDIA_CACHE_KEY, JSON.stringify(assets));
  } catch {
    // D1 metadata sync remains authoritative when local storage is unavailable.
  }
}

export function mergeBridgeMediaAssets(assets: MediaAsset[]) {
  const byId = new Map<string, MediaAsset>();

  [...assets, ...getBridgeMediaAssets()].forEach((asset) => {
    if (asset.id) {
      byId.set(asset.id, asset);
    }
  });

  return [...byId.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function cacheBridgeMediaAsset(asset: MediaAsset) {
  const assets = mergeBridgeMediaAssets([asset]);
  writeBridgeMediaAssets(assets);
  return asset;
}

export function removeBridgeMediaAsset(id: string) {
  writeBridgeMediaAssets(getBridgeMediaAssets().filter((asset) => asset.id !== id));
}

export function clearBridgeMediaAssetsForTests() {
  try {
    getStorage()?.removeItem(BRIDGE_MEDIA_CACHE_KEY);
  } catch {
    // Test cleanup is best effort.
  }
}
