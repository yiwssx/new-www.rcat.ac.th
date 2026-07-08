import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicEventList,
  getPublicEventListCache,
  PUBLIC_EVENT_LIST_CACHE_TTL_MS,
  setPublicEventListCache
} from "../../features/public-events";

const publicEventListQueryGcTimeMs = 60 * 60 * 1000;

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicEventList() {
  const cachedSnapshot = useMemo(() => getPublicEventListCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_EVENT_LIST_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["public-event-list"],
    queryFn: async () => {
      const snapshot = await getPublicEventList();
      setPublicEventListCache(snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    staleTime: PUBLIC_EVENT_LIST_CACHE_TTL_MS,
    gcTime: publicEventListQueryGcTimeMs,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
