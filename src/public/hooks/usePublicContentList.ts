import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicContentListCache,
  PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
  publicContentListQueryOptions
} from "../../features/public-content";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";
import type { PublicContentListKind } from "../../types";

export function usePublicContentList(kind: PublicContentListKind) {
  const cachedSnapshot = useMemo(() => getPublicContentListCache(kind), [kind]);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_CONTENT_LIST_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicContentListQueryOptions(kind),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
