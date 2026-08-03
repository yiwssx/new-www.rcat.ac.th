import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicSearchIndexSnapshot } from "./api";
import { PUBLIC_SEARCH_INDEX_CACHE_TTL_MS, setPublicSearchIndexCache } from "./cache";

export const publicSearchIndexQueryKey = ["public-search-index"] as const;

export function publicSearchIndexQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicSearchIndexQueryKey,
    queryFn: async (context) => {
      const snapshot = await getPublicSearchIndexSnapshot(getPublicQueryRequestOptions(context, runtimeOptions));
      setPublicSearchIndexCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
