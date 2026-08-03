import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicProgramListSnapshot } from "./api";
import { PUBLIC_PROGRAM_LIST_CACHE_TTL_MS, setPublicProgramListCache } from "./cache";

export const publicProgramListQueryKey = ["public-program-list"] as const;

export function publicProgramListQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicProgramListQueryKey,
    queryFn: async (context) => {
      const snapshot = await getPublicProgramListSnapshot(getPublicQueryRequestOptions(context, runtimeOptions));
      setPublicProgramListCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_PROGRAM_LIST_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
