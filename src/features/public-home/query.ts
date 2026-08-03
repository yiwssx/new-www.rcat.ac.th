import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicHomeSnapshot } from "./api";
import { PUBLIC_HOME_CACHE_TTL_MS, setPublicHomeCache } from "./cache";

export const publicHomeQueryKey = ["public-home-snapshot"] as const;

export function publicHomeQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicHomeQueryKey,
    queryFn: async (context) => {
      const snapshot = await getPublicHomeSnapshot(getPublicQueryRequestOptions(context, runtimeOptions));
      setPublicHomeCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_HOME_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
