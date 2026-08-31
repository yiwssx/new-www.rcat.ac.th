import { getAdminContentList } from "../admin-pagination/api";
import { getAdminContentDetailFromCloudflare, saveContentItemToCloudflare } from "../admin-write/cloudflareApi";
import { CmsAuthError } from "../cms-auth";
import { importFacebookThumbnailAsset } from "../cms-media";
import type { ContentItem } from "../public-content/types";
import { isFacebookEmbedContent } from "../../utils/facebookContent";

const BACKFILL_PAGE_SIZE = 100;
const FACEBOOK_IMPORT_OWNER = "facebook-import";
const DEFAULT_BACKFILL_CONCURRENCY = 3;
const MAX_BACKFILL_CONCURRENCY = 5;
const FACEBOOK_PREVIEW_RETRY_DELAYS_MS = [1_000, 3_000] as const;
const FACEBOOK_PREVIEW_RETRY_MESSAGE = "Unable to create Facebook thumbnail";

export interface LegacyFacebookThumbnailBackfillResult {
  scanned: number;
  candidates: number;
  repaired: number;
  skipped: number;
  failed: number;
  failedIds: string[];
}

export interface LegacyFacebookThumbnailBackfillProgress {
  phase: "scanning" | "repairing";
  scanned: number;
  candidates: number;
  completed: number;
  repaired: number;
  skipped: number;
  failed: number;
}

export interface LegacyFacebookThumbnailBackfillOptions {
  concurrency?: number;
  onProgress?: (progress: LegacyFacebookThumbnailBackfillProgress) => void;
}

function hasAttachedMedia(item: ContentItem) {
  return Array.isArray(item.mediaIds) && item.mediaIds.some(Boolean);
}

function isFacebookImportOwner(owner: string | undefined) {
  return owner?.trim().toLowerCase() === FACEBOOK_IMPORT_OWNER;
}

function canRepairLegacyFacebookThumbnail(item: ContentItem) {
  return (
    item.status === "published" &&
    isFacebookImportOwner(item.owner) &&
    !item.featuredMediaId &&
    !hasAttachedMedia(item) &&
    Boolean(item.canonicalUrl?.trim()) &&
    isFacebookEmbedContent(item)
  );
}

function normalizeConcurrency(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_BACKFILL_CONCURRENCY;
  }

  return Math.min(MAX_BACKFILL_CONCURRENCY, Math.max(1, Math.floor(value ?? DEFAULT_BACKFILL_CONCURRENCY)));
}

function shouldAbortForCmsAuth(error: unknown) {
  return error instanceof CmsAuthError && [401, 403, 428].includes(error.status);
}

function shouldRetryFacebookPreview(error: unknown) {
  return error instanceof Error && error.message === FACEBOOK_PREVIEW_RETRY_MESSAGE;
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

async function importFacebookThumbnailWithRetry(input: Parameters<typeof importFacebookThumbnailAsset>[0]) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await importFacebookThumbnailAsset(input);
    } catch (error) {
      if (shouldAbortForCmsAuth(error) || !shouldRetryFacebookPreview(error) || attempt >= FACEBOOK_PREVIEW_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await wait(FACEBOOK_PREVIEW_RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function findLegacyFacebookCandidateIds(onProgress?: LegacyFacebookThumbnailBackfillOptions["onProgress"]) {
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
      ...response.items
        .filter(
          (item) => isFacebookImportOwner(item.owner) && !item.featuredMediaId && isFacebookEmbedContent(item)
        )
        .map((item) => item.id)
    );

    onProgress?.({
      phase: "scanning",
      scanned,
      candidates: new Set(ids).size,
      completed: 0,
      repaired: 0,
      skipped: 0,
      failed: 0
    });

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

  const asset = await importFacebookThumbnailWithRetry({
    sourceUrl,
    name: `Facebook - ${item.title}`.slice(0, 160),
    owner: item.owner.trim() || FACEBOOK_IMPORT_OWNER
  });

  await saveContentItemToCloudflare({
    ...item,
    featuredMediaId: asset.id,
    mediaIds: Array.from(new Set([...(item.mediaIds ?? []), asset.id]))
  });

  return true;
}

export async function backfillLegacyFacebookThumbnails(
  options: LegacyFacebookThumbnailBackfillOptions = {}
): Promise<LegacyFacebookThumbnailBackfillResult> {
  const { ids, scanned } = await findLegacyFacebookCandidateIds(options.onProgress);
  const concurrency = normalizeConcurrency(options.concurrency);
  let repaired = 0;
  let skipped = 0;
  let completed = 0;
  const failedIds: string[] = [];

  options.onProgress?.({
    phase: "repairing",
    scanned,
    candidates: ids.length,
    completed,
    repaired,
    skipped,
    failed: failedIds.length
  });

  for (let index = 0; index < ids.length; index += concurrency) {
    const batch = ids.slice(index, index + concurrency);
    const outcomes = await Promise.all(
      batch.map(async (id) => {
        try {
          return {
            id,
            repaired: await repairLegacyFacebookThumbnail(id),
            failed: false
          };
        } catch (error) {
          if (shouldAbortForCmsAuth(error)) {
            throw error;
          }

          return { id, repaired: false, failed: true };
        }
      })
    );

    for (const outcome of outcomes) {
      if (outcome.failed) {
        failedIds.push(outcome.id);
      } else if (outcome.repaired) {
        repaired += 1;
      } else {
        skipped += 1;
      }
    }

    completed += outcomes.length;
    options.onProgress?.({
      phase: "repairing",
      scanned,
      candidates: ids.length,
      completed,
      repaired,
      skipped,
      failed: failedIds.length
    });
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
