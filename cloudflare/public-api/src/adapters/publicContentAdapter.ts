import type {
  PublicContentDetailSnapshotContract,
  PublicContentItemContract,
  PublicContentListSnapshotContract
} from "../contracts/publicContent";
import type { PublicMetadataContract } from "../contracts/publicMetadata";
import type { PublicContentReadRow } from "../db/contentRepository";
import { filterPublicMedia } from "./publicMetadataAdapter";

function parseStringArray(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function mapContentRowToPublicContentItem(row: PublicContentReadRow): PublicContentItemContract {
  return {
    id: row.id || "",
    title: row.title || "",
    slug: row.slug || "",
    type: row.type || "page",
    status: "published",
    owner: row.owner || "",
    summary: row.summary || "",
    body: row.body_snapshot || "",
    content: row.body_snapshot || "",
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

export function createPublicContentListSnapshot(
  kind: PublicContentListSnapshotContract["kind"],
  rows: PublicContentReadRow[],
  pageRows: PublicContentReadRow[],
  metadata: PublicMetadataContract,
  generatedAt = new Date()
): PublicContentListSnapshotContract {
  const items = rows.map(mapContentRowToPublicContentItem);
  const pageItems = pageRows.map(mapContentRowToPublicContentItem);

  return {
    kind,
    items,
    ...(kind === "announcements" ? { pageItems } : {}),
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
  generatedAt = new Date()
): PublicContentDetailSnapshotContract {
  return {
    item: mapContentRowToPublicContentItem(row),
    generatedAt: generatedAt.toISOString()
  };
}
