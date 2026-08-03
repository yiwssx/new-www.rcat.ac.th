import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicSearchIndexSnapshot, getPublicSearchPageSnapshot, type PublicSearchPageInput } from "./api";
import { PUBLIC_SEARCH_INDEX_CACHE_TTL_MS, setPublicSearchIndexCache } from "./cache";

export const publicSearchIndexQueryKey = ["public-search-index"] as const;

export function getPublicSearchQueryKey(query = "") {
  const normalizedQuery = query.trim();
  return normalizedQuery ? ([...publicSearchIndexQueryKey, normalizedQuery] as const) : publicSearchIndexQueryKey;
}

export function getPublicSearchPageQueryKey(query: string, pageInput: PublicSearchPageInput) {
  const normalizedQuery = query.trim();
  const page = Math.max(1, Math.floor(pageInput.page));
  const pageSize = pageInput.pageSize === undefined ? undefined : Math.max(1, Math.floor(pageInput.pageSize));
  return [...publicSearchIndexQueryKey, "page", normalizedQuery, page, pageSize ?? null] as const;
}

export function publicSearchIndexQueryOptions(query = "", runtimeOptions: PublicQueryRuntimeOptions = {}) {
  const normalizedQuery = query.trim();

  return queryOptions({
    queryKey: getPublicSearchQueryKey(normalizedQuery),
    queryFn: async (context) => {
      const snapshot = await getPublicSearchIndexSnapshot(
        normalizedQuery,
        getPublicQueryRequestOptions(context, runtimeOptions)
      );
      if (!normalizedQuery) {
        setPublicSearchIndexCache(snapshot);
      }
      return snapshot;
    },
    staleTime: PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}

export function publicSearchPageQueryOptions(
  query: string,
  pageInput: PublicSearchPageInput,
  runtimeOptions: PublicQueryRuntimeOptions = {}
) {
  const normalizedQuery = query.trim();

  return queryOptions({
    queryKey: getPublicSearchPageQueryKey(normalizedQuery, pageInput),
    queryFn: (context) =>
      getPublicSearchPageSnapshot(normalizedQuery, pageInput, getPublicQueryRequestOptions(context, runtimeOptions)),
    staleTime: PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
