import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCmsSnapshot } from "../../services/googleApi";
import {
  getPublicSnapshotCache,
  PUBLIC_SNAPSHOT_CACHE_TTL_MS,
  setPublicSnapshotCache
} from "../../services/publicCmsCache";

const publicQueryGcTimeMs = 60 * 60 * 1000;

interface UsePublicCmsSnapshotOptions {
  enabled?: boolean;
}

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicCmsSnapshot(options: UsePublicCmsSnapshotOptions = {}) {
  const enabled = options.enabled ?? true;
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
    enabled,
    staleTime: PUBLIC_SNAPSHOT_CACHE_TTL_MS,
    gcTime: publicQueryGcTimeMs,
    refetchOnMount: enabled && (cachedSnapshot ? !hasFreshCache : true),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
