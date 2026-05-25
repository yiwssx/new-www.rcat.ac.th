import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicHomeCache,
  getPublicHomeSnapshot,
  PUBLIC_HOME_CACHE_TTL_MS,
  setPublicHomeCache
} from "../../features/public-home";

const publicHomeQueryGcTimeMs = 60 * 60 * 1000;

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicHomeSnapshot() {
  const cachedSnapshot = useMemo(() => getPublicHomeCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_HOME_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["public-home-snapshot"],
    queryFn: async () => {
      const snapshot = await getPublicHomeSnapshot();
      setPublicHomeCache(snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    staleTime: PUBLIC_HOME_CACHE_TTL_MS,
    gcTime: publicHomeQueryGcTimeMs,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
