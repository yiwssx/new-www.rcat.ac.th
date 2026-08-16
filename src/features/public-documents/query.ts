import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_CACHE_FRESHNESS_MS,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicDocumentList } from "./api";

export const publicDocumentListQueryKey = ["public-document-list"] as const;

export function publicDocumentListQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicDocumentListQueryKey,
    queryFn: (context) => getPublicDocumentList(getPublicQueryRequestOptions(context, runtimeOptions)),
    staleTime: PUBLIC_CACHE_FRESHNESS_MS.collection,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
