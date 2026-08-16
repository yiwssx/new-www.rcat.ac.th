import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_CACHE_FRESHNESS_MS,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import {
  getPublicAnnouncementsContentListSnapshot,
  getPublicContentDetailSnapshot,
  getPublicContentListPageSnapshot,
  getPublicContentListSnapshot,
  isPublicContentNotFoundError,
  type PublicContentListPageInput
} from "./api";
import type { PublicContentListKind } from "./types";

function normalizePageInput(pageInput: PublicContentListPageInput) {
  return {
    page: Math.max(1, Math.floor(pageInput.page)),
    pageSize:
      pageInput.pageSize === undefined
        ? undefined
        : Math.min(100, Math.max(1, Math.floor(pageInput.pageSize)))
  };
}

export function publicContentListQueryKey(
  kind: PublicContentListKind,
  pageItemsInput?: PublicContentListPageInput,
  pageInput?: PublicContentListPageInput
) {
  if (pageInput) {
    const normalized = normalizePageInput(pageInput);
    return ["public-content-list", kind, "page", normalized.page, normalized.pageSize ?? null] as const;
  }

  if (kind !== "announcements" || !pageItemsInput) {
    return ["public-content-list", kind] as const;
  }

  const normalized = normalizePageInput(pageItemsInput);
  return ["public-content-list", kind, "pages", normalized.page, normalized.pageSize ?? null] as const;
}

export function publicContentListQueryOptions(
  kind: PublicContentListKind,
  runtimeOptions: PublicQueryRuntimeOptions = {},
  pageItemsInput?: PublicContentListPageInput,
  pageInput?: PublicContentListPageInput
) {
  return queryOptions({
    queryKey: publicContentListQueryKey(kind, pageItemsInput, pageInput),
    queryFn: async (context) => {
      const requestOptions = getPublicQueryRequestOptions(context, runtimeOptions);

      if (pageInput) {
        return getPublicContentListPageSnapshot(kind, pageInput, requestOptions);
      }

      if (kind === "announcements" && pageItemsInput) {
        return getPublicAnnouncementsContentListSnapshot(pageItemsInput, requestOptions);
      }

      return getPublicContentListSnapshot(kind, requestOptions);
    },
    staleTime: PUBLIC_CACHE_FRESHNESS_MS.collection,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}

export function publicContentDetailQueryKey(slug: string | undefined) {
  return ["content-detail", slug] as const;
}

export function publicContentDetailQueryOptions(
  slug: string | undefined,
  runtimeOptions: PublicQueryRuntimeOptions = {}
) {
  return queryOptions({
    queryKey: publicContentDetailQueryKey(slug),
    queryFn: async (context) => {
      if (!slug) {
        throw new Error("Content slug is required.");
      }

      try {
        return await getPublicContentDetailSnapshot(
          { slug },
          getPublicQueryRequestOptions(context, runtimeOptions)
        );
      } catch (error) {
        if (isPublicContentNotFoundError(error)) {
          return null;
        }

        throw error;
      }
    },
    enabled: Boolean(slug),
    staleTime: PUBLIC_CACHE_FRESHNESS_MS.detail,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
