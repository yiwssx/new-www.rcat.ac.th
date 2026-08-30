import { deleteMediaMetadataFromCloudflare, saveMediaMetadataToCloudflare } from "../admin-write/cloudflareApi";
import { cacheBridgeMediaAsset, removeBridgeMediaAsset } from "./bridgeCache";
import { importFacebookThumbnailFromBridge } from "./facebookThumbnailClient";
import {
  deleteMediaAssetFromBridge,
  saveMediaAssetToBridge,
  uploadMediaAssetToBridge,
  type MediaUploadOptions
} from "./mediaBridgeClient";
import type { FacebookThumbnailImportInput, MediaAsset, MediaAssetInput } from "./types";

async function persistBridgeMetadata(asset: MediaAsset) {
  cacheBridgeMediaAsset(asset);

  try {
    return cacheBridgeMediaAsset(await saveMediaMetadataToCloudflare(asset));
  } catch {
    // Keep the returned bridge metadata visible until a later D1 metadata sync succeeds.
    return asset;
  }
}

export async function saveMediaAsset(input: MediaAssetInput, options: MediaUploadOptions = {}) {
  return persistBridgeMetadata(await saveMediaAssetToBridge(input, options));
}

export async function importFacebookThumbnailAsset(input: FacebookThumbnailImportInput) {
  return persistBridgeMetadata(await importFacebookThumbnailFromBridge(input));
}

export async function uploadMediaAsset(asset: MediaAsset) {
  return persistBridgeMetadata(await uploadMediaAssetToBridge(asset));
}

function getMediaAssetId(asset: string | Pick<MediaAsset, "id">) {
  return typeof asset === "string" ? asset : asset.id;
}

export async function deleteMediaAsset(asset: string | MediaAsset) {
  const id = getMediaAssetId(asset);
  const result = await deleteMediaAssetFromBridge(asset);

  try {
    await deleteMediaMetadataFromCloudflare(id);
  } catch {
    // The Drive delete succeeded; remove the local bridge entry even if D1 metadata cleanup must be retried.
  }

  removeBridgeMediaAsset(id);
  return result;
}

export type { FacebookThumbnailImportInput, MediaAssetInput } from "./types";
export type { MediaUploadOptions, MediaUploadProgress } from "./mediaBridgeClient";
