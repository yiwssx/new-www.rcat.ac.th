import {
  deleteContentItemFromCloudflare,
  getAdminContentDetailFromCloudflare,
  publishContentFromCloudflare,
  saveContentItemToCloudflare
} from "../admin-write/cloudflareApi";
import type { ContentItem } from "../public-content/types";
import { isAdminStaleRevisionError } from "../admin-write/errors";

export async function saveContentItem(item: ContentItem): Promise<ContentItem> {
  try {
    return await saveContentItemToCloudflare(item);
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
