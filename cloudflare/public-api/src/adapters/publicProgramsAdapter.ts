import { mapContentRowToPublicContentItem } from "./publicContentAdapter";
import { filterPublicMedia } from "./publicMetadataAdapter";
import type { PublicProgramListSnapshotContract } from "../contracts/publicPrograms";
import type { PublicMetadataContract } from "../contracts/publicMetadata";
import type { PublicContentReadRow } from "../db/contentRepository";

export function createPublicProgramListSnapshot(
  rows: PublicContentReadRow[],
  metadata: PublicMetadataContract,
  generatedAt = new Date()
): PublicProgramListSnapshotContract {
  const items = rows.map(mapContentRowToPublicContentItem);

  return {
    items,
    media: filterPublicMedia(metadata.media, items),
    siteSettings: metadata.siteSettings,
    homepageSettings: metadata.homepageSettings,
    displaySettings: metadata.displaySettings,
    menu: metadata.menu,
    generatedAt: generatedAt.toISOString()
  };
}
