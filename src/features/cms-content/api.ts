import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import {
  deleteContentItemFromCloudflare,
  getAdminContentDetailFromCloudflare,
  publishContentFromCloudflare,
  saveContentItemToCloudflare
} from "../admin-write/cloudflareApi";
import {
  deleteContentItem as deleteContentItemFromAppsScript,
  getAdminContentDetail as getAdminContentDetailFromAppsScript,
  publishContent as publishContentFromAppsScript,
  saveContentItem as saveContentItemToAppsScript
} from "../../services/googleApi";
import type { ContentItem } from "../public-content/types";
import { isAdminStaleRevisionError } from "../admin-write/errors";

export async function saveContentItem(item: ContentItem): Promise<ContentItem> {
  if (getAdminWriteProvider() !== "cloudflare") {
    return saveContentItemToAppsScript(item);
  }

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
  return getAdminWriteProvider() === "cloudflare"
    ? getAdminContentDetailFromCloudflare(input)
    : getAdminContentDetailFromAppsScript(input);
}

export async function deleteContentItem(
  input: string | Pick<ContentItem, "id" | "revision">
): Promise<{ id: string; deleted: boolean }> {
  const id = typeof input === "string" ? input : input.id;
  return getAdminWriteProvider() === "cloudflare"
    ? deleteContentItemFromCloudflare(input)
    : deleteContentItemFromAppsScript(id);
}

export async function publishContent(
  input: string | Pick<ContentItem, "id" | "revision">
): Promise<{ id: string; published: boolean }> {
  const id = typeof input === "string" ? input : input.id;
  return getAdminWriteProvider() === "cloudflare"
    ? publishContentFromCloudflare(input)
    : publishContentFromAppsScript(id);
}
