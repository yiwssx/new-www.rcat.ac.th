import { queryOptions } from "@tanstack/react-query";
import { PUBLIC_QUERY_GC_TIME_MS } from "../public-read/queryPolicy";
import { getContentDetail, getPublicContentListSnapshot, isPublicContentNotFoundError } from "./api";
import {
  PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
  PUBLIC_CONTENT_LIST_CACHE_TTL_MS,
  removePublicContentDetailCache,
  setPublicContentDetailCache,
  setPublicContentListCache
} from "./cache";
import type { PublicContentListKind } from "./types";

export function publicContentListQueryKey(kind: PublicContentListKind) {
  return ["public-content-list", kind] as const;
}

export function publicContentListQueryOptions(kind: PublicContentListKind) {
  return queryOptions({
    queryKey: publicContentListQueryKey(kind),
    queryFn: async ({ signal }) => {
      const snapshot = await getPublicContentListSnapshot(kind, { signal });
      setPublicContentListCache(kind, snapshot);
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

export function publicContentDetailQueryOptions(slug: string | undefined) {
  return queryOptions({
    queryKey: publicContentDetailQueryKey(slug),
    queryFn: async ({ signal }) => {
      if (!slug) {
        throw new Error("Content slug is required.");
      }

      try {
        const content = await getContentDetail({ slug }, { signal });
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
