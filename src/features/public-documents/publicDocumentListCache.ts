import { PUBLIC_CACHE_FRESHNESS_MS } from "../../config/publicCachePolicy";
import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";
import type { PublicDocumentListSnapshot } from "./types";

export const PUBLIC_DOCUMENT_LIST_CACHE_KEY = "rcat.cms.public.document-list.v1";
const LEGACY_PUBLIC_DOCUMENT_LIST_CACHE_KEY = "rcat.cms.public.document-list";
export const PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS = PUBLIC_CACHE_FRESHNESS_MS.collection;

export function getPublicDocumentListCache() {
  const current = readPublicCache<PublicDocumentListSnapshot>(PUBLIC_DOCUMENT_LIST_CACHE_KEY);
  if (current) {
    return current;
  }

  const legacy = readPublicCache<PublicDocumentListSnapshot>(LEGACY_PUBLIC_DOCUMENT_LIST_CACHE_KEY);
  if (!legacy) {
    return null;
  }

  const remainingTtlMs = Math.max(0, PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS - (Date.now() - legacy.savedAt));
  if (remainingTtlMs <= 0) {
    removePublicCache(LEGACY_PUBLIC_DOCUMENT_LIST_CACHE_KEY);
    return null;
  }

  writePublicCache(PUBLIC_DOCUMENT_LIST_CACHE_KEY, legacy.data, remainingTtlMs);
  removePublicCache(LEGACY_PUBLIC_DOCUMENT_LIST_CACHE_KEY);
  return readPublicCache<PublicDocumentListSnapshot>(PUBLIC_DOCUMENT_LIST_CACHE_KEY);
}

export function setPublicDocumentListCache(snapshot: PublicDocumentListSnapshot) {
  writePublicCache(PUBLIC_DOCUMENT_LIST_CACHE_KEY, snapshot, PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS);
}

export function clearPublicDocumentListCache() {
  removePublicCache(PUBLIC_DOCUMENT_LIST_CACHE_KEY);
  removePublicCache(LEGACY_PUBLIC_DOCUMENT_LIST_CACHE_KEY);
}
