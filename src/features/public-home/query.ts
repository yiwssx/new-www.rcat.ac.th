import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_CACHE_FRESHNESS_MS,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicHomeSnapshot } from "./api";

export const publicHomeQueryKey = ["public-home-snapshot"] as const;

export function publicHomeQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicHomeQueryKey,
    queryFn: (context) => getPublicHomeSnapshot(getPublicQueryRequestOptions(context, runtimeOptions)),
    staleTime: PUBLIC_CACHE_FRESHNESS_MS.collection,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
