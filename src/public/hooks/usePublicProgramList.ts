import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicProgramListCache,
  getPublicProgramListSnapshot,
  PUBLIC_PROGRAM_LIST_CACHE_TTL_MS,
  setPublicProgramListCache
} from "../../features/public-programs";

const publicProgramListQueryGcTimeMs = 60 * 60 * 1000;

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicProgramList() {
  const cachedSnapshot = useMemo(() => getPublicProgramListCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_PROGRAM_LIST_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["public-program-list"],
    queryFn: async () => {
      const snapshot = await getPublicProgramListSnapshot();
      setPublicProgramListCache(snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    staleTime: PUBLIC_PROGRAM_LIST_CACHE_TTL_MS,
    gcTime: publicProgramListQueryGcTimeMs,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
