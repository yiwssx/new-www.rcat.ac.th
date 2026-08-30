import type { MediaAsset, PublicContentCardItem } from "../../types";

export function resolveCardThumbnail(item: PublicContentCardItem, mediaAssets: MediaAsset[]) {
  const featuredMedia = mediaAssets.find((asset) => asset.id === item.featuredMediaId);

  if (featuredMedia?.type === "image") {
    return featuredMedia;
  }

  const attachedIds = item.mediaIds ?? [];
  return attachedIds
    .map((id) => mediaAssets.find((asset) => asset.id === id))
    .find((asset): asset is MediaAsset => asset?.type === "image");
}
