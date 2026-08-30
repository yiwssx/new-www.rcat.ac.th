import { getAdminContentList } from "../admin-pagination/api";
import { getAdminContentDetailFromCloudflare, saveContentItemToCloudflare } from "../admin-write/cloudflareApi";
import { importFacebookThumbnailAsset } from "../cms-media";
import type { ContentItem } from "../public-content/types";
import { isFacebookEmbedContent } from "../../utils/facebookContent";

const BACKFILL_PAGE_SIZE = 100;

export interface LegacyFacebookThumbnailBackfillResult {
  scanned: number;
  candidates: number;
  repaired: number;
  skipped: number;
  failed: number;
  failedIds: string[];
}

function hasAttachedMedia(item: ContentItem) {
  return Array.isArray(item.mediaIds) && item.mediaIds.some(Boolean);
}

function canRepairLegacyFacebookThumbnail(item: ContentItem) {
  return (
    item.status === "published" &&
    !item.featuredMediaId &&
    !hasAttachedMedia(item) &&
    Boolean(item.canonicalUrl?.trim()) &&
    isFacebookEmbedContent(item)
  );
}

async function findLegacyFacebookCandidateIds() {
  const ids: string[] = [];
  let page = 1;
  let scanned = 0;

  for (;;) {
    const response = await getAdminContentList({
      page,
      pageSize: BACKFILL_PAGE_SIZE,
      status: "published",
      sortBy: "publishAt",
      sortDirection: "desc"
    });

    scanned += response.items.length;
    ids.push(
      ...response.items.filter((item) => !item.featuredMediaId && isFacebookEmbedContent(item)).map((item) => item.id)
    );

    const totalPages = Math.max(response.pagination.totalPages, 1);
    if (page >= totalPages) {
      break;
    }
    page += 1;
  }

  return { ids: [...new Set(ids)], scanned };
}

async function repairLegacyFacebookThumbnail(id: string) {
  const item = await getAdminContentDetailFromCloudflare({ id });

  if (!canRepairLegacyFacebookThumbnail(item)) {
    return false;
  }

  const sourceUrl = item.canonicalUrl?.trim() ?? "";
  if (!sourceUrl) {
    return false;
  }

  const asset = await importFacebookThumbnailAsset({
    sourceUrl,
    name: `Facebook - ${item.title}`.slice(0, 160),
    owner: item.owner.trim() || "ผู้แก้ไข CMS"
  });

  await saveContentItemToCloudflare({
    ...item,
    featuredMediaId: asset.id,
    mediaIds: Array.from(new Set([...(item.mediaIds ?? []), asset.id]))
  });

  return true;
}

export async function backfillLegacyFacebookThumbnails(): Promise<LegacyFacebookThumbnailBackfillResult> {
  const { ids, scanned } = await findLegacyFacebookCandidateIds();
  let repaired = 0;
  let skipped = 0;
  const failedIds: string[] = [];

  for (const id of ids) {
    try {
      if (await repairLegacyFacebookThumbnail(id)) {
        repaired += 1;
      } else {
        skipped += 1;
      }
    } catch {
      failedIds.push(id);
    }
  }

  return {
    scanned,
    candidates: ids.length,
    repaired,
    skipped,
    failed: failedIds.length,
    failedIds
  };
}
