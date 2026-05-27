import type { PublicProgramListSnapshot } from "./types";
import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";

export const PUBLIC_PROGRAM_LIST_CACHE_KEY = "rcat.cms.public.program-list";
export const PUBLIC_PROGRAM_LIST_CACHE_TTL_MS = 15 * 60 * 1000;

export function getPublicProgramListCache() {
  return readPublicCache<PublicProgramListSnapshot>(PUBLIC_PROGRAM_LIST_CACHE_KEY);
}

export function setPublicProgramListCache(snapshot: PublicProgramListSnapshot) {
  writePublicCache(PUBLIC_PROGRAM_LIST_CACHE_KEY, snapshot, PUBLIC_PROGRAM_LIST_CACHE_TTL_MS);
}

export function clearPublicProgramListCache() {
  removePublicCache(PUBLIC_PROGRAM_LIST_CACHE_KEY);
}
