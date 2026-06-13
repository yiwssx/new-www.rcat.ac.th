import type { PublicContentItemContract } from "./publicContent";
import type { PublicDocumentItemContract } from "./publicDocuments";

export interface PublicHomeSectionContract {
  id: string;
  key: string;
  title: string;
  summary: string;
  href: string;
  order: number;
  updatedAt: string;
}

export interface PublicHomeSnapshotContract {
  sections: PublicHomeSectionContract[];
  featuredContent: PublicContentItemContract[];
  featuredDocuments: PublicDocumentItemContract[];
  programs: PublicContentItemContract[];
  generatedAt: string;
}
