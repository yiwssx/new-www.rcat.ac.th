import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import {
  getContentDetail,
  getPublicAnnouncementsContentListSnapshot,
  getPublicContentListSnapshot,
  isPublicContentNotFoundError,
  type PublicContentListPageInput
} from "./api";
import {
  PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
  PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
  removePublicContentDetailCache,
  setPublicContentDetailCache,
  setPublicContentListCache
} from "./cache";
import type { PublicContentListKind } from "./types";

function normalizePageInput(pageInput: PublicContentListPageInput) {
  return {
    page: Math.max(1, Math.floor(pageInput.page)),
    pageSize: pageInput.pageSize === undefined ? undefined : Math.min(100, Math.max(1, Math.floor(pageInput.pageSize)))
  };
}

export function publicContentListQueryKey(
  kind: PublicContentListKind,
  pageItemsInput?: PublicContentListPageInput
) {
  if (kind !== "announcements" || !pageItemsInput) {
    return ["public-content-list", kind] as const;
  }

  const normalized = normalizePageInput(pageItemsInput);
  return ["public-content-list", kind, "pages", normalized.page, normalized.pageSize ?? null] as const;
}

export function publicContentListQueryOptions(
  kind: PublicContentListKind,
  runtimeOptions: PublicQueryRuntimeOptions = {},
  pageItemsInput?: PublicContentListPageInput
) {
  return queryOptions({
    queryKey: publicContentListQueryKey(kind, pageItemsInput),
    queryFn: async (context) => {
      const requestOptions = getPublicQueryRequestOptions(context, runtimeOptions);
      const snapshot =
        kind === "announcements" && pageItemsInput
          ? await getPublicAnnouncementsContentListSnapshot(pageItemsInput, requestOptions)
          : await getPublicContentListSnapshot(kind, requestOptions);

      if (kind !== "announcements" || !pageItemsInput || normalizePageInput(pageItemsInput).page === 1) {
        setPublicContentListCache(kind, snapshot);
      }

      return snapshot;
    },
    staleTime: PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
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
        const content = await getContentDetail({ slug }, getPublicQueryRequestOptions(context, runtimeOptions));
        setPublicContentDetailCache(slug, content);
        return content;
      } catch (error) {
        if (isPublicContentNotFoundError(error)) {
          removePublicContentDetailCache(slug);
          return null;
        }

        throw error;
      }
    },
    enabled: Boolean(slug),
    staleTime: PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
