import { mapContentRowToPublicContentItem } from "./publicContentAdapter";
import type { PublicProgramListSnapshotContract } from "../contracts/publicPrograms";
import type { PublicContentReadRow } from "../db/contentRepository";

export function createPublicProgramListSnapshot(
  rows: PublicContentReadRow[],
  generatedAt = new Date()
): PublicProgramListSnapshotContract {
  return {
    items: rows.map(mapContentRowToPublicContentItem),
    generatedAt: generatedAt.toISOString()
  };
}
