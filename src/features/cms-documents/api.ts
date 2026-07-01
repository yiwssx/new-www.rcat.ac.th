import { deleteDocumentFromCloudflare, saveDocumentToCloudflare } from "../admin-write/cloudflareApi";
import type { CmsDocumentItem, DocumentItemInput } from "./types";
export type { DocumentItemInput } from "./types";

export async function saveDocumentToApi(document: DocumentItemInput): Promise<CmsDocumentItem> {
  return saveDocumentToCloudflare(document);
}

export async function deleteDocumentFromApi(id: string): Promise<{ id: string; deleted: boolean }> {
  return deleteDocumentFromCloudflare(id);
}
