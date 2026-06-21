import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import {
  deleteMediaAsset as deleteMediaAssetFromAppsScript,
  saveMediaAsset as saveMediaAssetToAppsScript,
  uploadMediaAsset as uploadMediaAssetToAppsScript,
  type MediaAssetInput
} from "../../services/googleApi";
import { deleteMediaMetadataFromCloudflare, saveMediaMetadataToCloudflare } from "../admin-write/cloudflareApi";
import { cacheBridgeMediaAsset, removeBridgeMediaAsset } from "./bridgeCache";
import type { MediaAsset } from "./types";

async function persistBridgeMetadata(asset: MediaAsset) {
  cacheBridgeMediaAsset(asset);

  if (getAdminWriteProvider() !== "cloudflare") {
    return asset;
  }

  try {
    return cacheBridgeMediaAsset(await saveMediaMetadataToCloudflare(asset));
  } catch {
    // Keep the returned bridge metadata visible until a later D1 metadata sync succeeds.
    return asset;
  }
}

export async function saveMediaAsset(input: MediaAssetInput) {
  return persistBridgeMetadata(await saveMediaAssetToAppsScript(input));
}

export async function uploadMediaAsset(asset: MediaAsset) {
  return persistBridgeMetadata(await uploadMediaAssetToAppsScript(asset));
}

export async function deleteMediaAsset(id: string) {
  const result = await deleteMediaAssetFromAppsScript(id);

  if (getAdminWriteProvider() === "cloudflare") {
    try {
      await deleteMediaMetadataFromCloudflare(id);
    } catch {
      // The Drive delete succeeded; remove the local bridge entry even if D1 metadata cleanup must be retried.
    }
  }

  removeBridgeMediaAsset(id);
  return result;
}

export type { MediaAssetInput } from "../../services/googleApi";
