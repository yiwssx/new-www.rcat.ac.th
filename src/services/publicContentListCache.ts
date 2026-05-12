import { PublicContentListKind, PublicContentListSnapshot } from "../types";
import { readPublicCache, removePublicCache, writePublicCache } from "./publicCmsCache";

export const PUBLIC_CONTENT_LIST_CACHE_TTL_MS = 15 * 60 * 1000;

const publicContentListCachePrefix = "rcat.cms.public.content-list.";
const publicContentListKinds: PublicContentListKind[] = ["news", "announcements", "blog"];

export function getPublicContentListCacheKey(kind: PublicContentListKind) {
  return `${publicContentListCachePrefix}${kind}`;
}

export function getPublicContentListCache(kind: PublicContentListKind) {
  return readPublicCache<PublicContentListSnapshot>(getPublicContentListCacheKey(kind));
}

export function setPublicContentListCache(kind: PublicContentListKind, snapshot: PublicContentListSnapshot) {
  writePublicCache(getPublicContentListCacheKey(kind), snapshot, PUBLIC_CONTENT_LIST_CACHE_TTL_MS);
}

export function clearPublicContentListCache() {
  publicContentListKinds.forEach((kind) => {
    removePublicCache(getPublicContentListCacheKey(kind));
  });
}
