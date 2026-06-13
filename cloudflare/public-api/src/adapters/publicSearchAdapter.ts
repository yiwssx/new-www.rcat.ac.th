import { mapContentRowToPublicContentItem } from "./publicContentAdapter";
import type { PublicSearchSnapshotContract } from "../contracts/publicSearch";
import type { PublicContentReadRow } from "../db/contentRepository";

export function createPublicSearchSnapshot(
  query: string,
  rows: PublicContentReadRow[],
  generatedAt = new Date()
): PublicSearchSnapshotContract {
  return {
    query,
    items: rows.map(mapContentRowToPublicContentItem),
    generatedAt: generatedAt.toISOString()
  };
}
