import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicContentDetailCache,
  PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS,
  publicContentDetailQueryOptions
} from "../../features/public-content";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";
import type {
  ContentItem,
  MediaAsset,
  PublicContentCardItem,
  PublicContentDetailSnapshot
} from "../../types";

export function usePublicContentDetail(input: { slug?: string }) {
  const slug = input.slug;
  const cachedContent = useMemo(() => getPublicContentDetailCache(slug), [slug]);
  const hasFreshCache = cachedContent
    ? isPublicQueryCacheFresh(cachedContent.savedAt, PUBLIC_CONTENT_DETAIL_CACHE_TTL_MS)
    : false;
  const query = useQuery({
    ...publicContentDetailQueryOptions(slug, { consumeAbortSignal: false }),
    initialData: cachedContent?.data,
    initialDataUpdatedAt: cachedContent?.savedAt,
    refetchOnMount: cachedContent ? !hasFreshCache : true
  });
  const detail = query.data as PublicContentDetailSnapshot | null | undefined;
  const item: ContentItem | null | undefined = detail === null || detail === undefined ? detail : detail.item;
  const media: MediaAsset[] = detail?.media ?? [];
  const relatedItems: PublicContentCardItem[] = detail?.relatedItems ?? [];

  return {
    ...query,
    data: item,
    media,
    relatedItems
  } as Omit<typeof query, "data"> & {
    data: ContentItem | null | undefined;
    media: MediaAsset[];
    relatedItems: PublicContentCardItem[];
  };
}
