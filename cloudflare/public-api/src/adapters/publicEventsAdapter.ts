import type { PublicEventListSnapshotContract } from "../contracts/publicEvents";
import type { PublicEventContract } from "../contracts/publicMetadata";
import type { EventRow, MediaAssetRow } from "../db/schema";
import { mapMediaAssetRowToPublicMediaAsset } from "./publicMediaAdapter";

function parseEventMediaIds(value: string) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item, index, items) => items.indexOf(item) === index);
  } catch {
    return [];
  }
}

export function mapEventRowToPublicEventItem(row: EventRow): PublicEventContract {
  return {
    id: row.id || "",
    title: row.title || "",
    date: row.date || "",
    ...(row.end_date ? { endDate: row.end_date } : {}),
    audience: row.audience || "",
    status: "confirmed",
    ...(row.location ? { location: row.location } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.category ? { category: row.category } : {}),
    visibility: "public",
    mediaIds: parseEventMediaIds(row.media_ids_json),
    updatedAt: row.updated_at || ""
  };
}

export function createPublicEventListSnapshot(
  rows: EventRow[],
  mediaRows: MediaAssetRow[],
  generatedAt = new Date()
): PublicEventListSnapshotContract {
  return {
    items: rows.map(mapEventRowToPublicEventItem),
    media: mediaRows.map(mapMediaAssetRowToPublicMediaAsset),
    generatedAt: generatedAt.toISOString()
  };
}
