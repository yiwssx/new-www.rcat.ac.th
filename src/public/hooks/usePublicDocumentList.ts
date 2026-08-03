import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicDocumentListCache,
  PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS,
  publicDocumentListQueryOptions
} from "../../features/public-documents";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicDocumentList() {
  const cachedSnapshot = useMemo(() => getPublicDocumentListCache(), []);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicDocumentListQueryOptions({ consumeAbortSignal: false }),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
