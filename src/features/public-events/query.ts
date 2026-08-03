import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicEventList } from "./api";
import { PUBLIC_EVENT_LIST_CACHE_TTL_MS, setPublicEventListCache } from "./publicEventListCache";

export const publicEventListQueryKey = ["public-event-list"] as const;

export function publicEventListQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicEventListQueryKey,
    queryFn: async (context) => {
      const snapshot = await getPublicEventList(getPublicQueryRequestOptions(context, runtimeOptions));
      setPublicEventListCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_EVENT_LIST_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
