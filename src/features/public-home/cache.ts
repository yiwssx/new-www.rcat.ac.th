import type { PublicHomeSnapshot } from "../../types";
import { readPublicCache, removePublicCache, writePublicCache } from "../../services/publicCmsCache";

const LEGACY_PUBLIC_HOME_CACHE_KEY = "rcat.cms.public.home.snapshot.v2";
export const PUBLIC_HOME_CACHE_KEY = "rcat.cms.public.home.snapshot.v3";
export const PUBLIC_HOME_CACHE_TTL_MS = 15 * 60 * 1000;

export function getPublicHomeCache() {
  removePublicCache(LEGACY_PUBLIC_HOME_CACHE_KEY);
  return readPublicCache<PublicHomeSnapshot>(PUBLIC_HOME_CACHE_KEY);
}

export function setPublicHomeCache(snapshot: PublicHomeSnapshot) {
  writePublicCache(PUBLIC_HOME_CACHE_KEY, snapshot, PUBLIC_HOME_CACHE_TTL_MS);
}

export function clearPublicHomeCache() {
  removePublicCache(LEGACY_PUBLIC_HOME_CACHE_KEY);
  removePublicCache(PUBLIC_HOME_CACHE_KEY);
}
