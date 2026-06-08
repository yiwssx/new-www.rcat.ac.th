import type { PublicDocumentItemContract, PublicDocumentListSnapshotContract } from "../contracts/publicDocuments";
import type { DocumentRow } from "../db/schema";

function normalizePublicDocumentOrder(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function mapDocumentRowToPublicDocumentItem(row: DocumentRow): PublicDocumentItemContract {
  return {
    id: row.id || "",
    title: row.title || "",
    description: row.description || "",
    category: row.category || "",
    fileUrl: row.file_url || "",
    fileName: row.file_name || "",
    mediaId: row.media_id || "",
    publishedAt: row.published_at || "",
    order: normalizePublicDocumentOrder(row.sort_order),
    pinned: row.pinned === 1,
    updatedAt: row.updated_at || ""
  };
}

export function createPublicDocumentListSnapshot(
  rows: DocumentRow[],
  generatedAt = new Date()
): PublicDocumentListSnapshotContract {
  return {
    items: rows.map(mapDocumentRowToPublicDocumentItem),
    generatedAt: generatedAt.toISOString()
  };
}
