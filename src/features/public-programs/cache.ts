import type { PublicProgramListSnapshot } from "./types";
import { PUBLIC_CACHE_FRESHNESS_MS } from "../../config/publicCachePolicy";
import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";

export const PUBLIC_PROGRAM_LIST_CACHE_KEY = "rcat.cms.public.program-list.v2";
export const PUBLIC_PROGRAM_LIST_CACHE_TTL_MS = PUBLIC_CACHE_FRESHNESS_MS.collection;

export function getPublicProgramListCache() {
  return readPublicCache<PublicProgramListSnapshot>(PUBLIC_PROGRAM_LIST_CACHE_KEY);
}

export function setPublicProgramListCache(snapshot: PublicProgramListSnapshot) {
  writePublicCache(PUBLIC_PROGRAM_LIST_CACHE_KEY, snapshot, PUBLIC_PROGRAM_LIST_CACHE_TTL_MS);
}

export function clearPublicProgramListCache() {
  removePublicCache(PUBLIC_PROGRAM_LIST_CACHE_KEY);
}
