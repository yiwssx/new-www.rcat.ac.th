import { PUBLIC_CACHE_FRESHNESS_MS } from "../../config/publicCachePolicy";
import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";
import type { PublicEventListSnapshot } from "./types";

export const PUBLIC_EVENT_LIST_CACHE_KEY = "rcat.cms.public.event-list.v2";
export const PUBLIC_EVENT_LIST_CACHE_TTL_MS = PUBLIC_CACHE_FRESHNESS_MS.collection;

export function getPublicEventListCache() {
  return readPublicCache<PublicEventListSnapshot>(PUBLIC_EVENT_LIST_CACHE_KEY);
}

export function setPublicEventListCache(snapshot: PublicEventListSnapshot) {
  writePublicCache(PUBLIC_EVENT_LIST_CACHE_KEY, snapshot, PUBLIC_EVENT_LIST_CACHE_TTL_MS);
}

export function clearPublicEventListCache() {
  removePublicCache(PUBLIC_EVENT_LIST_CACHE_KEY);
}
