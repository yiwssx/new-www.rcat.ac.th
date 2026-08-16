import type { PublicSearchIndexSnapshot } from "./types";
import { PUBLIC_CACHE_FRESHNESS_MS } from "../../config/publicCachePolicy";
import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";

export const PUBLIC_SEARCH_INDEX_CACHE_KEY = "rcat.cms.public.search-index.v2";
export const PUBLIC_SEARCH_INDEX_CACHE_TTL_MS = PUBLIC_CACHE_FRESHNESS_MS.collection;

export function getPublicSearchIndexCache() {
  return readPublicCache<PublicSearchIndexSnapshot>(PUBLIC_SEARCH_INDEX_CACHE_KEY);
}

export function setPublicSearchIndexCache(snapshot: PublicSearchIndexSnapshot) {
  writePublicCache(PUBLIC_SEARCH_INDEX_CACHE_KEY, snapshot, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS);
}

export function clearPublicSearchIndexCache() {
  removePublicCache(PUBLIC_SEARCH_INDEX_CACHE_KEY);
}
