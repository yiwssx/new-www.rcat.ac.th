import type { PublicDocumentItem } from "../public-documents/types";

export type DocumentStatus = "draft" | "published";

export interface CmsDocumentItem extends PublicDocumentItem {
  status: DocumentStatus;
}

export type DocumentItemInput = Partial<CmsDocumentItem>;
