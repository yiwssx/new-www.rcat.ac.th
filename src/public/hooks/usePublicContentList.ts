import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicContentListCache,
  PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
  publicContentListQueryOptions,
  type PublicContentListPageInput
} from "../../features/public-content";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";
import type { PublicContentListKind } from "../../types";

function normalizePageInput(pageInput: PublicContentListPageInput | undefined) {
  if (!pageInput) {
    return undefined;
  }

  return {
    page: Math.max(1, Math.floor(pageInput.page)),
    pageSize: pageInput.pageSize === undefined ? undefined : Math.min(100, Math.max(1, Math.floor(pageInput.pageSize)))
  };
}

export function usePublicContentList(kind: PublicContentListKind, pageItemsInput?: PublicContentListPageInput) {
  const normalizedPageItemsInput = normalizePageInput(pageItemsInput);
  const normalizedPageItemsPage = normalizedPageItemsInput?.page;
  const normalizedPageItemsPageSize = normalizedPageItemsInput?.pageSize;
  const cachedSnapshot = useMemo(() => {
    const cached = getPublicContentListCache(kind);

    if (!cached || kind !== "announcements" || normalizedPageItemsPage === undefined) {
      return cached;
    }

    const cachedPagination = cached.data.pageItemsPagination;

    if (
      normalizedPageItemsPage !== 1 ||
      !cachedPagination ||
      cachedPagination.page !== 1 ||
      (normalizedPageItemsPageSize !== undefined && cachedPagination.pageSize !== normalizedPageItemsPageSize)
    ) {
      return null;
    }

    return cached;
  }, [kind, normalizedPageItemsPage, normalizedPageItemsPageSize]);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_CONTENT_LIST_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicContentListQueryOptions(kind, { consumeAbortSignal: false }, normalizedPageItemsInput),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
