import type { PublicEventContract, PublicMediaAssetContract } from "./publicMetadata";

export interface PublicEventListSnapshotContract {
  items: PublicEventContract[];
  media: PublicMediaAssetContract[];
  generatedAt: string;
}
