import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getContentDetail,
  getPublicContentDetailCache,
  isPublicContentNotFoundError,
  PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
  removePublicContentDetailCache,
  setPublicContentDetailCache
} from "../../features/public-content";

const publicQueryGcTimeMs = 60 * 60 * 1000;

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicContentDetail(input: { slug?: string }) {
  const slug = input.slug;
  const cachedContent = useMemo(() => getPublicContentDetailCache(slug), [slug]);
  const hasFreshCache = cachedContent ? isFresh(cachedContent.savedAt, PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["content-detail", slug],
    queryFn: async () => {
      if (!slug) {
        throw new Error("Content slug is required.");
      }

      try {
        const content = await getContentDetail({ slug });
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
    initialData: cachedContent?.data,
    initialDataUpdatedAt: cachedContent?.savedAt,
    staleTime: PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
    gcTime: publicQueryGcTimeMs,
    refetchOnMount: cachedContent ? !hasFreshCache : true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
