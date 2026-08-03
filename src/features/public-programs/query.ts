import { queryOptions } from "@tanstack/react-query";
import { PUBLIC_QUERY_GC_TIME_MS } from "../public-read/queryPolicy";
import { getPublicProgramListSnapshot } from "./api";
import { PUBLIC_PROGRAM_LIST_CACHE_TTL_MS, setPublicProgramListCache } from "./cache";

export const publicProgramListQueryKey = ["public-program-list"] as const;

export function publicProgramListQueryOptions() {
  return queryOptions({
    queryKey: publicProgramListQueryKey,
    queryFn: async ({ signal }) => {
      const snapshot = await getPublicProgramListSnapshot({ signal });
      setPublicProgramListCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_PROGRAM_LIST_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
