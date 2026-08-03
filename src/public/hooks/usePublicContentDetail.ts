import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicContentDetailCache,
  PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
  publicContentDetailQueryOptions
} from "../../features/public-content";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicContentDetail(input: { slug?: string }) {
  const slug = input.slug;
  const cachedContent = useMemo(() => getPublicContentDetailCache(slug), [slug]);
  const hasFreshCache = cachedContent
    ? isPublicQueryCacheFresh(cachedContent.savedAt, PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicContentDetailQueryOptions(slug, { consumeAbortSignal: false }),
    initialData: cachedContent?.data,
    initialDataUpdatedAt: cachedContent?.savedAt,
    refetchOnMount: cachedContent ? !hasFreshCache : true
  });
}
