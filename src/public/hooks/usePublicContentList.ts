import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicContentListSnapshot } from "../../services/googleApi";
import {
  getPublicContentListCache,
  PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
  setPublicContentListCache
} from "../../services/publicContentListCache";
import { PublicContentListKind } from "../../types";

const publicContentListQueryGcTimeMs = 60 * 60 * 1000;

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicContentList(kind: PublicContentListKind) {
  const cachedSnapshot = useMemo(() => getPublicContentListCache(kind), [kind]);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_CONTENT_LIST_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["public-content-list", kind],
    queryFn: async () => {
      const snapshot = await getPublicContentListSnapshot(kind);
      setPublicContentListCache(kind, snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    staleTime: PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
    gcTime: publicContentListQueryGcTimeMs,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
