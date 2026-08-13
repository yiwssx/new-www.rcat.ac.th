import { useQuery } from "@tanstack/react-query";
import {
  getPublicContentListCache,
  PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
  publicContentListQueryOptions,
  type PublicContentListPageInput
} from "../../features/public-content";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";
import type { PublicContentListKind } from "../../types";

interface UsePublicContentListOptions {
  pageInput?: PublicContentListPageInput;
}

function normalizePageInput(pageInput: PublicContentListPageInput | undefined) {
  if (!pageInput) {
    return undefined;
  }

  return {
    page: Math.max(1, Math.floor(pageInput.page)),
    pageSize: pageInput.pageSize === undefined ? undefined : Math.min(100, Math.max(1, Math.floor(pageInput.pageSize)))
  };
}

function getEligibleContentListCache(
  kind: PublicContentListKind,
  pageItemsInput: PublicContentListPageInput | undefined,
  pageInput: PublicContentListPageInput | undefined
) {
  if (pageInput) {
    return null;
  }

  const cached = getPublicContentListCache(kind);

  if (!cached || kind !== "announcements" || !pageItemsInput) {
    return cached;
  }

  const cachedPagination = cached.data.pageItemsPagination;

  if (
    pageItemsInput.page !== 1 ||
    !cachedPagination ||
    cachedPagination.page !== 1 ||
    (pageItemsInput.pageSize !== undefined && cachedPagination.pageSize !== pageItemsInput.pageSize)
  ) {
    return null;
  }

  return cached;
}

export function usePublicContentList(
  kind: PublicContentListKind,
  pageItemsInput?: PublicContentListPageInput,
  options: UsePublicContentListOptions = {}
) {
  const normalizedPageItemsInput = normalizePageInput(pageItemsInput);
  const normalizedPageInput = normalizePageInput(options.pageInput);
  const cachedSnapshot = getEligibleContentListCache(kind, normalizedPageItemsInput, normalizedPageInput);
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_CONTENT_LIST_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicContentListQueryOptions(
      kind,
      { consumeAbortSignal: false },
      normalizedPageItemsInput,
      normalizedPageInput
    ),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
