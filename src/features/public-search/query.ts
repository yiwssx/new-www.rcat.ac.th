import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_CACHE_FRESHNESS_MS,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicSearchIndexSnapshot, getPublicSearchPageSnapshot, type PublicSearchPageInput } from "./api";

export const publicSearchIndexQueryKey = ["public-search-index"] as const;

export function getPublicSearchQueryKey(query = "") {
  const normalizedQuery = query.trim();
  return normalizedQuery ? ([...publicSearchIndexQueryKey, normalizedQuery] as const) : publicSearchIndexQueryKey;
}

export function getPublicSearchPageQueryKey(query: string, pageInput: PublicSearchPageInput) {
  const normalizedQuery = query.trim();
  const page = Math.max(1, Math.floor(pageInput.page));
  const pageSize =
    pageInput.pageSize === undefined ? undefined : Math.min(100, Math.max(1, Math.floor(pageInput.pageSize)));
  return [...publicSearchIndexQueryKey, "page", normalizedQuery, page, pageSize ?? null] as const;
}

export function publicSearchIndexQueryOptions(
  query = "",
  runtimeOptions: PublicQueryRuntimeOptions = {},
  pageInput?: PublicSearchPageInput
) {
  const normalizedQuery = query.trim();
  const queryKey = pageInput
    ? getPublicSearchPageQueryKey(normalizedQuery, pageInput)
    : getPublicSearchQueryKey(normalizedQuery);

  return queryOptions({
    queryKey,
    queryFn: (context) => {
      const requestOptions = getPublicQueryRequestOptions(context, runtimeOptions);

      return pageInput
        ? getPublicSearchPageSnapshot(normalizedQuery, pageInput, requestOptions)
        : getPublicSearchIndexSnapshot(normalizedQuery, requestOptions);
    },
    staleTime: PUBLIC_CACHE_FRESHNESS_MS.collection,
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
  return publicSearchIndexQueryOptions(query, runtimeOptions, pageInput);
}
