import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicSearchIndexCache,
  getPublicSearchIndexSnapshot,
  PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
  setPublicSearchIndexCache
} from "../../features/public-search";

const publicSearchIndexQueryGcTimeMs = 60 * 60 * 1000;

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicSearchIndex() {
  const cachedSnapshot = useMemo(() => getPublicSearchIndexCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["public-search-index"],
    queryFn: async () => {
      const snapshot = await getPublicSearchIndexSnapshot();
      setPublicSearchIndexCache(snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    staleTime: PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
    gcTime: publicSearchIndexQueryGcTimeMs,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
