import {
  deleteContentItemFromCloudflare,
  getAdminContentDetailFromCloudflare,
  publishContentFromCloudflare,
  saveContentItemToCloudflare
} from "../admin-write/cloudflareApi";
import { importFacebookThumbnailAsset, type FacebookThumbnailProgress } from "../cms-media";
import type { ContentItem } from "../public-content/types";
import { isAdminStaleRevisionError } from "../admin-write/errors";
import { isFacebookEmbedContent } from "../../utils/facebookContent";

export type ContentSaveProgressPhase = "preparing" | "facebook-thumbnail" | "saving";

export interface ContentSaveProgress {
  phase: ContentSaveProgressPhase;
  percent: number;
  message: string;
}

export interface SaveContentItemOptions {
  onProgress?: (progress: ContentSaveProgress) => void;
}

function reportSaveProgress(options: SaveContentItemOptions, progress: ContentSaveProgress) {
  options.onProgress?.(progress);
}

function reportFacebookThumbnailProgress(options: SaveContentItemOptions, progress: FacebookThumbnailProgress) {
  const attempt = progress.attempt ?? 1;
  const totalAttempts = progress.totalAttempts ?? 1;

  if (progress.phase === "requesting") {
    reportSaveProgress(options, {
      phase: "facebook-thumbnail",
      percent: attempt > 1 ? 40 : 35,
      message:
        totalAttempts > 1
          ? `กำลังดึงภาพย่อจาก Facebook (แหล่ง ${attempt}/${totalAttempts})`
          : "กำลังดึงภาพย่อจาก Facebook"
    });
    return;
  }

  if (progress.phase === "retrying") {
    const nextAttempt = Math.min(attempt + 1, totalAttempts);
    reportSaveProgress(options, {
      phase: "facebook-thumbnail",
      percent: 40,
      message: `แหล่งภาพปัจจุบันยังไม่พร้อม กำลังลองแหล่งสำรอง ${nextAttempt}/${totalAttempts}`
    });
    return;
  }

  if (progress.phase === "received") {
    reportSaveProgress(options, {
      phase: "facebook-thumbnail",
      percent: 50,
      message: "ได้รับภาพย่อจาก Facebook แล้ว กำลังเตรียมจัดเก็บ"
    });
    return;
  }

  if (progress.phase === "persisting") {
    reportSaveProgress(options, {
      phase: "facebook-thumbnail",
      percent: 60,
      message: "กำลังบันทึกข้อมูลภาพย่อ"
    });
    return;
  }

  reportSaveProgress(options, {
    phase: "facebook-thumbnail",
    percent: 65,
    message: "เตรียมภาพย่อ Facebook เรียบร้อยแล้ว"
  });
}

function hasAttachedMedia(item: ContentItem) {
  return Array.isArray(item.mediaIds) && item.mediaIds.some(Boolean);
}

async function addAutomaticFacebookThumbnail(item: ContentItem, options: SaveContentItemOptions): Promise<ContentItem> {
  const sourceUrl = item.canonicalUrl?.trim() ?? "";

  if (item.featuredMediaId || hasAttachedMedia(item) || !sourceUrl || !isFacebookEmbedContent(item)) {
    return item;
  }

  reportSaveProgress(options, {
    phase: "facebook-thumbnail",
    percent: 30,
    message: "กำลังเตรียมดึงภาพย่อจาก Facebook"
  });

  try {
    const asset = await importFacebookThumbnailAsset(
      {
        sourceUrl,
        name: `Facebook - ${item.title}`.slice(0, 160),
        owner: item.owner.trim() || "ผู้แก้ไข CMS"
      },
      {
        onProgress: (progress) => reportFacebookThumbnailProgress(options, progress)
      }
    );

    return {
      ...item,
      featuredMediaId: asset.id,
      mediaIds: Array.from(new Set([...(item.mediaIds ?? []), asset.id]))
    };
  } catch {
    reportSaveProgress(options, {
      phase: "facebook-thumbnail",
      percent: 60,
      message: "ไม่พบภาพย่ออัตโนมัติ กำลังบันทึกเนื้อหาต่อ"
    });

    // A Facebook preview is convenience media. A transient Facebook/Drive failure must not block content publishing.
    return item;
  }
}

export async function saveContentItem(item: ContentItem, options: SaveContentItemOptions = {}): Promise<ContentItem> {
  reportSaveProgress(options, {
    phase: "preparing",
    percent: 10,
    message: "กำลังตรวจสอบข้อมูลก่อนบันทึก"
  });

  const nextItem = await addAutomaticFacebookThumbnail(item, options);

  reportSaveProgress(options, {
    phase: "saving",
    percent: 75,
    message: "กำลังบันทึกข้อมูลเนื้อหา"
  });

  try {
    const savedItem = await saveContentItemToCloudflare(nextItem);

    reportSaveProgress(options, {
      phase: "saving",
      percent: 85,
      message: "บันทึกข้อมูลเนื้อหาแล้ว"
    });

    return savedItem;
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
