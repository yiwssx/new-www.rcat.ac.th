import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicDocumentList,
  getPublicDocumentListCache,
  PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS,
  setPublicDocumentListCache
} from "../../features/public-documents";

const publicDocumentListQueryGcTimeMs = 60 * 60 * 1000;

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicDocumentList() {
  const cachedSnapshot = useMemo(() => getPublicDocumentListCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["public-document-list"],
    queryFn: async () => {
      const snapshot = await getPublicDocumentList();
      setPublicDocumentListCache(snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    staleTime: PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS,
    gcTime: publicDocumentListQueryGcTimeMs,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
