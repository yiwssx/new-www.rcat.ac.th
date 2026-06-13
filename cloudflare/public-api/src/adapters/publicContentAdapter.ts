import type {
  PublicContentDetailSnapshotContract,
  PublicContentItemContract,
  PublicContentListSnapshotContract
} from "../contracts/publicContent";
import type { PublicContentReadRow } from "../db/contentRepository";

export function mapContentRowToPublicContentItem(row: PublicContentReadRow): PublicContentItemContract {
  return {
    id: row.id || "",
    slug: row.slug || "",
    title: row.title || "",
    summary: row.summary || "",
    content: row.body_snapshot || "",
    category: row.category || "",
    publishedAt: row.publish_at || "",
    updatedAt: row.updated_at || ""
  };
}

export function createPublicContentListSnapshot(
  rows: PublicContentReadRow[],
  generatedAt = new Date()
): PublicContentListSnapshotContract {
  return {
    items: rows.map(mapContentRowToPublicContentItem),
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
