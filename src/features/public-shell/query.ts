import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicShellSnapshot } from "./api";

export const publicShellQueryKey = ["public-shell"] as const;

export function publicShellQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicShellQueryKey,
    queryFn: (context) => getPublicShellSnapshot(getPublicQueryRequestOptions(context, runtimeOptions)),
    staleTime: 15 * 60 * 1000,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
