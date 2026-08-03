import { queryOptions } from "@tanstack/react-query";
import { PUBLIC_QUERY_GC_TIME_MS } from "../public-read/queryPolicy";
import { getPublicHomeSnapshot } from "./api";
import { PUBLIC_HOME_CACHE_TTL_MS, setPublicHomeCache } from "./cache";

export const publicHomeQueryKey = ["public-home-snapshot"] as const;

export function publicHomeQueryOptions() {
  return queryOptions({
    queryKey: publicHomeQueryKey,
    queryFn: async ({ signal }) => {
      const snapshot = await getPublicHomeSnapshot({ signal });
      setPublicHomeCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_HOME_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
