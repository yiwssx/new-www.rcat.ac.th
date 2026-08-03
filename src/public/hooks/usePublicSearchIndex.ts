import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicSearchIndexCache,
  PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
  publicSearchIndexQueryOptions,
  publicSearchPageQueryOptions
} from "../../features/public-search";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicSearchIndex(query = "", page?: number, pageSize?: number, enabled = true) {
  const normalizedQuery = query.trim();
  const paginated = page !== undefined && pageSize !== undefined;
  const cachedSnapshot = useMemo(
    () => (paginated || normalizedQuery ? null : getPublicSearchIndexCache()),
    [normalizedQuery, paginated]
  );
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS)
    : false;
  const reusableOptions = paginated
    ? publicSearchPageQueryOptions(
        normalizedQuery,
        {
          page,
          pageSize
        },
        { consumeAbortSignal: false }
      )
    : publicSearchIndexQueryOptions(normalizedQuery, { consumeAbortSignal: false });

  return useQuery({
    ...reusableOptions,
    initialData: paginated ? undefined : cachedSnapshot?.data,
    initialDataUpdatedAt: paginated ? undefined : cachedSnapshot?.savedAt,
    refetchOnMount: paginated ? true : cachedSnapshot ? !hasFreshCache : true,
    enabled
  });
}
