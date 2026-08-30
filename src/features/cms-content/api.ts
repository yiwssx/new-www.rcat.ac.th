import {
  deleteContentItemFromCloudflare,
  getAdminContentDetailFromCloudflare,
  publishContentFromCloudflare,
  saveContentItemToCloudflare
} from "../admin-write/cloudflareApi";
import { importFacebookThumbnailAsset } from "../cms-media";
import type { ContentItem } from "../public-content/types";
import { isAdminStaleRevisionError } from "../admin-write/errors";
import { isFacebookEmbedContent } from "../../utils/facebookContent";

function hasAttachedMedia(item: ContentItem) {
  return Array.isArray(item.mediaIds) && item.mediaIds.some(Boolean);
}

async function addAutomaticFacebookThumbnail(item: ContentItem): Promise<ContentItem> {
  const sourceUrl = item.canonicalUrl?.trim() ?? "";

  if (item.featuredMediaId || hasAttachedMedia(item) || !sourceUrl || !isFacebookEmbedContent(item)) {
    return item;
  }

  try {
    const asset = await importFacebookThumbnailAsset({
      sourceUrl,
      name: `Facebook - ${item.title}`.slice(0, 160),
      owner: item.owner.trim() || "ผู้แก้ไข CMS"
    });

    return {
      ...item,
      featuredMediaId: asset.id,
      mediaIds: Array.from(new Set([...(item.mediaIds ?? []), asset.id]))
    };
  } catch {
    // A Facebook preview is convenience media. A transient Facebook/Drive failure must not block content publishing.
    return item;
  }
}

export async function saveContentItem(item: ContentItem): Promise<ContentItem> {
  const nextItem = await addAutomaticFacebookThumbnail(item);

  try {
    return await saveContentItemToCloudflare(nextItem);
  } catch (error) {
    if (isAdminStaleRevisionError(error) && item.id) {
      try {
        error.latestItem = await getAdminContentDetailFromCloudflare({ id: item.id });
      } catch {
        // Keep the stale-write message even if the refresh is temporarily unavailable.
      }
    }

    throw error;
  }
}

export async function getAdminContentDetail(input: { id?: string; slug?: string }): Promise<ContentItem> {
  return getAdminContentDetailFromCloudflare(input);
}

export async function deleteContentItem(
  input: string | Pick<ContentItem, "id" | "revision">
): Promise<{ id: string; deleted: boolean }> {
  return deleteContentItemFromCloudflare(input);
}

export async function publishContent(
  input: string | Pick<ContentItem, "id" | "revision">
): Promise<{ id: string; published: boolean }> {
  const id = typeof input === "string" ? input : input.id;

  try {
    return await publishContentFromCloudflare(input);
  } catch (error) {
    if (isAdminStaleRevisionError(error) && id) {
      try {
        error.latestItem = await getAdminContentDetailFromCloudflare({ id });
      } catch {
        // Keep the stale-write message even if the refresh is temporarily unavailable.
      }
    }

    throw error;
  }
}
