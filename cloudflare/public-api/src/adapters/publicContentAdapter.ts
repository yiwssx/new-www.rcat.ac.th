import type {
  PublicContentCardContract,
  PublicContentDetailSnapshotContract,
  PublicContentItemContract,
  PublicContentListSnapshotContract,
  PublicContentSummaryContract
} from "../contracts/publicContent";
import type { PublicMediaAssetContract, PublicMetadataContract } from "../contracts/publicMetadata";
import type {
  PublicContentCardReadRow,
  PublicContentReadRow,
  PublicContentSummaryReadRow
} from "../db/contentRepository";
import { filterPublicMedia } from "./publicMetadataAdapter";

function parseStringArray(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function mapContentCardRowToPublicContentCard(
  row: PublicContentCardReadRow | PublicContentSummaryReadRow
): PublicContentCardContract {
  return {
    id: row.id || "",
    title: row.title || "",
    slug: row.slug || "",
    type: row.type || "page",
    status: "published",
    owner: row.owner || "",
    summary: row.summary || "",
    category: row.category || "",
    tags: parseStringArray(row.tags_json),
    canonicalUrl: row.canonical_url || "",
    featured: row.featured === 1,
    readingMinutes: Math.max(0, Number(row.reading_minutes) || 0),
    template: row.template || "",
    featuredMediaId: row.featured_media_id || "",
    mediaIds: "media_ids_json" in row ? parseStringArray(row.media_ids_json) : [],
    publishAt: row.publish_at || ""
  };
}

export function mapContentSummaryRowToPublicContentItem(
  row: PublicContentSummaryReadRow
): PublicContentSummaryContract {
  return {
    id: row.id || "",
    title: row.title || "",
    slug: row.slug || "",
    type: row.type || "page",
    status: "published",
    owner: row.owner || "",
    summary: row.summary || "",
    category: row.category || "",
    tags: parseStringArray(row.tags_json),
    seoTitle: row.seo_title || "",
    seoDescription: row.seo_description || "",
    canonicalUrl: row.canonical_url || "",
    featured: row.featured === 1,
    readingMinutes: Math.max(0, Number(row.reading_minutes) || 0),
    template: row.template || "",
    featuredMediaId: row.featured_media_id || "",
    mediaIds: parseStringArray(row.media_ids_json),
    viewCount: Math.max(0, Number(row.view_count) || 0),
    lastViewedAt: row.last_viewed_at || "",
    publishAt: row.publish_at || "",
    publishedAt: row.publish_at || "",
    updatedAt: row.updated_at || ""
  };
}

export function mapContentRowToPublicContentItem(row: PublicContentReadRow): PublicContentItemContract {
  return {
    ...mapContentSummaryRowToPublicContentItem(row),
    body: row.body_snapshot || "",
    content: row.body_snapshot || ""
  };
}

function normalizeCategoryList(category: string) {
  return category
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sharedCategoryScore(left: string, right: string) {
  const rightLookup = new Set(normalizeCategoryList(right));
  return normalizeCategoryList(left).filter((item) => rightLookup.has(item)).length;
}

function sharedTagScore(left: string[], right: string[]) {
  const rightLookup = new Set(right);
  return left.filter((tag) => rightLookup.has(tag)).length;
}

export function selectRelatedPublicContentCards(
  item: PublicContentItemContract,
  candidates: PublicContentCardContract[],
  limit = 3
) {
  return candidates
    .filter((candidate) => candidate.id !== item.id)
    .map((candidate) => ({
      candidate,
      score:
        (candidate.type === item.type ? 4 : 0) +
        sharedCategoryScore(candidate.category, item.category) * 3 +
        sharedTagScore(candidate.tags, item.tags)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return Date.parse(right.candidate.publishAt) - Date.parse(left.candidate.publishAt);
    })
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((entry) => entry.candidate);
}

export function selectRelatedPublicContentCardRows(
  row: PublicContentReadRow,
  candidateRows: PublicContentCardReadRow[],
  limit = 3
) {
  const item = mapContentRowToPublicContentItem(row);
  const rowsById = new Map(candidateRows.map((candidate) => [candidate.id, candidate]));
  return selectRelatedPublicContentCards(item, candidateRows.map(mapContentCardRowToPublicContentCard), limit)
    .map((candidate) => rowsById.get(candidate.id))
    .filter((candidate): candidate is PublicContentCardReadRow => Boolean(candidate));
}

export function createPublicContentListSnapshot(
  kind: PublicContentListSnapshotContract["kind"],
  rows: PublicContentSummaryReadRow[],
  pageRows: PublicContentSummaryReadRow[],
  metadata: PublicMetadataContract,
  generatedAt = new Date(),
  pagination?: PublicContentListSnapshotContract["pagination"],
  pageItemsPagination?: PublicContentListSnapshotContract["pageItemsPagination"]
): PublicContentListSnapshotContract {
  const items = rows.map(mapContentSummaryRowToPublicContentItem);
  const pageItems = pageRows.map(mapContentSummaryRowToPublicContentItem);

  return {
    kind,
    items,
    ...(kind === "announcements" ? { pageItems } : {}),
    ...(pagination ? { pagination } : {}),
    ...(pageItemsPagination ? { pageItemsPagination } : {}),
    media: filterPublicMedia(metadata.media, [...items, ...pageItems]),
    siteSettings: metadata.siteSettings,
    homepageSettings: metadata.homepageSettings,
    displaySettings: metadata.displaySettings,
    menu: metadata.menu,
    generatedAt: generatedAt.toISOString()
  };
}

export function createPublicContentDetailSnapshot(
  row: PublicContentReadRow,
  media: PublicMediaAssetContract[] = [],
  relatedRows: PublicContentCardReadRow[] = [],
  generatedAt = new Date()
): PublicContentDetailSnapshotContract {
  const item = mapContentRowToPublicContentItem(row);
  const relatedItems = relatedRows.map(mapContentCardRowToPublicContentCard);

  return {
    item,
    media: filterPublicMedia(media, [item, ...relatedItems]),
    relatedItems,
    generatedAt: generatedAt.toISOString()
  };
}
