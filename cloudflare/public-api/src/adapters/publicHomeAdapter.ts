import { mapContentRowToPublicContentItem } from "./publicContentAdapter";
import { mapDocumentRowToPublicDocumentItem } from "./publicDocumentsAdapter";
import type { PublicHomeSectionContract, PublicHomeSnapshotContract } from "../contracts/publicHome";
import type { PublicContentReadRow } from "../db/contentRepository";
import type { DocumentRow, PublicHomeSectionRow } from "../db/schema";

function normalizePublicOrder(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function mapHomeSectionRowToPublicHomeSection(row: PublicHomeSectionRow): PublicHomeSectionContract {
  return {
    id: row.id || "",
    key: row.section_key || "",
    title: row.title || "",
    summary: row.summary || "",
    href: row.href || "",
    order: normalizePublicOrder(row.sort_order),
    updatedAt: row.updated_at || ""
  };
}

export function createPublicHomeSnapshot(
  input: {
    sections: PublicHomeSectionRow[];
    featuredContent: PublicContentReadRow[];
    featuredDocuments: DocumentRow[];
    programs: PublicContentReadRow[];
  },
  generatedAt = new Date()
): PublicHomeSnapshotContract {
  return {
    sections: input.sections.map(mapHomeSectionRowToPublicHomeSection),
    featuredContent: input.featuredContent.map(mapContentRowToPublicContentItem),
    featuredDocuments: input.featuredDocuments.map(mapDocumentRowToPublicDocumentItem),
    programs: input.programs.map(mapContentRowToPublicContentItem),
    generatedAt: generatedAt.toISOString()
  };
}
