import type { PublicEventContract } from "./publicMetadata";

export interface PublicEventListSnapshotContract {
  items: PublicEventContract[];
  generatedAt: string;
}
