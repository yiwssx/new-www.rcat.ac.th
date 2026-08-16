import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_CACHE_FRESHNESS_MS,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicShellSnapshot } from "./api";

export const publicShellQueryKey = ["public-shell"] as const;

export function publicShellQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicShellQueryKey,
    queryFn: (context) => getPublicShellSnapshot(getPublicQueryRequestOptions(context, runtimeOptions)),
    staleTime: PUBLIC_CACHE_FRESHNESS_MS.shell,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
}
