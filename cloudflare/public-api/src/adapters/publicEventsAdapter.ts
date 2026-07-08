import type { PublicEventListSnapshotContract } from "../contracts/publicEvents";
import type { PublicEventContract } from "../contracts/publicMetadata";
import type { EventRow } from "../db/schema";

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
    updatedAt: row.updated_at || ""
  };
}

export function createPublicEventListSnapshot(
  rows: EventRow[],
  generatedAt = new Date()
): PublicEventListSnapshotContract {
  return {
    items: rows.map(mapEventRowToPublicEventItem),
    generatedAt: generatedAt.toISOString()
  };
}
