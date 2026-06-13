import type { PublicContentItemContract } from "./publicContent";

export interface PublicSearchSnapshotContract {
  query: string;
  items: PublicContentItemContract[];
  generatedAt: string;
}
