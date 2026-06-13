import type { PublicContentItemContract } from "./publicContent";

export interface PublicProgramListSnapshotContract {
  items: PublicContentItemContract[];
  generatedAt: string;
}
