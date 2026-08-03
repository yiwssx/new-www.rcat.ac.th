import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicSearchIndexCache,
  PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
  publicSearchIndexQueryOptions,
  publicSearchPageQueryOptions
} from "../../features/public-search";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicSearchIndex(query = "") {
  const normalizedQuery = query.trim();
  const cachedSnapshot = useMemo(() => (normalizedQuery ? null : getPublicSearchIndexCache()), [normalizedQuery]);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicSearchIndexQueryOptions(normalizedQuery, { consumeAbortSignal: false }),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}

export function usePublicSearchPage(query: string, page: number, pageSize: number, enabled = true) {
  return useQuery({
    ...publicSearchPageQueryOptions(
      query,
      {
        page,
        pageSize
      },
      { consumeAbortSignal: false }
    ),
    enabled
  });
}
