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

export async function saveContentItem(item: ContentItem): Promise<ContentItem> {
  return getAdminWriteProvider() === "cloudflare"
    ? saveContentItemToCloudflare(item)
    : saveContentItemToAppsScript(item);
}

export async function getAdminContentDetail(input: { id?: string; slug?: string }): Promise<ContentItem> {
  return getAdminWriteProvider() === "cloudflare"
    ? getAdminContentDetailFromCloudflare(input)
    : getAdminContentDetailFromAppsScript(input);
}

export async function deleteContentItem(id: string): Promise<{ id: string; deleted: boolean }> {
  return getAdminWriteProvider() === "cloudflare"
    ? deleteContentItemFromCloudflare(id)
    : deleteContentItemFromAppsScript(id);
}

export async function publishContent(id: string): Promise<{ id: string; published: boolean }> {
  return getAdminWriteProvider() === "cloudflare" ? publishContentFromCloudflare(id) : publishContentFromAppsScript(id);
}
