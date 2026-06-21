import type { PublicSearchIndexSnapshot } from "./types";
import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";

export const PUBLIC_SEARCH_INDEX_CACHE_KEY = "rcat.cms.public.search-index.v2";
export const PUBLIC_SEARCH_INDEX_CACHE_TTL_MS = 15 * 60 * 1000;

export function getPublicSearchIndexCache() {
  return readPublicCache<PublicSearchIndexSnapshot>(PUBLIC_SEARCH_INDEX_CACHE_KEY);
}

export function setPublicSearchIndexCache(snapshot: PublicSearchIndexSnapshot) {
  writePublicCache(PUBLIC_SEARCH_INDEX_CACHE_KEY, snapshot, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS);
}

export function clearPublicSearchIndexCache() {
  removePublicCache(PUBLIC_SEARCH_INDEX_CACHE_KEY);
}
