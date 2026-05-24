import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";
import { PublicDocumentListSnapshot } from "./types";

export const PUBLIC_DOCUMENT_LIST_CACHE_KEY = "rcat.cms.public.document-list";
export const PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS = 15 * 60 * 1000;

export function getPublicDocumentListCache() {
  return readPublicCache<PublicDocumentListSnapshot>(PUBLIC_DOCUMENT_LIST_CACHE_KEY);
}

export function setPublicDocumentListCache(snapshot: PublicDocumentListSnapshot) {
  writePublicCache(PUBLIC_DOCUMENT_LIST_CACHE_KEY, snapshot, PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS);
}

export function clearPublicDocumentListCache() {
  removePublicCache(PUBLIC_DOCUMENT_LIST_CACHE_KEY);
}
