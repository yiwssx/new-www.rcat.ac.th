import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicDocumentList } from "./api";
import { PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS, setPublicDocumentListCache } from "./publicDocumentListCache";

export const publicDocumentListQueryKey = ["public-document-list"] as const;

export function publicDocumentListQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicDocumentListQueryKey,
    queryFn: async (context) => {
      const snapshot = await getPublicDocumentList(getPublicQueryRequestOptions(context, runtimeOptions));
      setPublicDocumentListCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
