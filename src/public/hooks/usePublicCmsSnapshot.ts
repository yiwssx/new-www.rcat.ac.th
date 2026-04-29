import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCmsSnapshot } from "../../services/googleApi";
import {
  getPublicSnapshotCache,
  PUBLIC_SNAPSHOT_CACHE_TTL_MS,
  setPublicSnapshotCache
} from "../../services/publicCmsCache";

const publicQueryGcTimeMs = 60 * 60 * 1000;

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicCmsSnapshot() {
  const cachedSnapshot = useMemo(() => getPublicSnapshotCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_SNAPSHOT_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: async () => {
      const snapshot = await getCmsSnapshot();
      setPublicSnapshotCache(snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    staleTime: PUBLIC_SNAPSHOT_CACHE_TTL_MS,
    gcTime: publicQueryGcTimeMs,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
