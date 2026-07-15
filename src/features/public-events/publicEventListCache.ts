import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";
import type { PublicEventListSnapshot } from "./types";

export const PUBLIC_EVENT_LIST_CACHE_KEY = "rcat.cms.public.event-list.v2";
export const PUBLIC_EVENT_LIST_CACHE_TTL_MS = 15 * 60 * 1000;

export function getPublicEventListCache() {
  return readPublicCache<PublicEventListSnapshot>(PUBLIC_EVENT_LIST_CACHE_KEY);
}

export function setPublicEventListCache(snapshot: PublicEventListSnapshot) {
  writePublicCache(PUBLIC_EVENT_LIST_CACHE_KEY, snapshot, PUBLIC_EVENT_LIST_CACHE_TTL_MS);
}

export function clearPublicEventListCache() {
  removePublicCache(PUBLIC_EVENT_LIST_CACHE_KEY);
}
