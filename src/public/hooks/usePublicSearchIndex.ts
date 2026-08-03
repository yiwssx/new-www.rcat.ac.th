import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicSearchIndexCache,
  PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
  publicSearchIndexQueryOptions
} from "../../features/public-search";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicSearchIndex() {
  const cachedSnapshot = useMemo(() => getPublicSearchIndexCache(), []);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicSearchIndexQueryOptions({ consumeAbortSignal: false }),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
