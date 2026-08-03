import { queryOptions } from "@tanstack/react-query";
import { PUBLIC_QUERY_GC_TIME_MS } from "../public-read/queryPolicy";
import { getPublicDocumentList } from "./api";
import { PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS, setPublicDocumentListCache } from "./publicDocumentListCache";

export const publicDocumentListQueryKey = ["public-document-list"] as const;

export function publicDocumentListQueryOptions() {
  return queryOptions({
    queryKey: publicDocumentListQueryKey,
    queryFn: async ({ signal }) => {
      const snapshot = await getPublicDocumentList({ signal });
      setPublicDocumentListCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
