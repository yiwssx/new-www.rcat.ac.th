import { mapContentRowToPublicContentItem } from "./publicContentAdapter";
import type { PublicSearchSnapshotContract } from "../contracts/publicSearch";
import type { PublicContentReadRow } from "../db/contentRepository";
import type { PublicMetadataContract } from "../contracts/publicMetadata";

export function createPublicSearchSnapshot(
  query: string,
  rows: PublicContentReadRow[],
  metadata: PublicMetadataContract,
  generatedAt = new Date()
): PublicSearchSnapshotContract {
  return {
    query,
    items: rows.map(mapContentRowToPublicContentItem),
    siteSettings: metadata.siteSettings,
    homepageSettings: metadata.homepageSettings,
    displaySettings: metadata.displaySettings,
    menu: metadata.menu,
    generatedAt: generatedAt.toISOString()
  };
}
