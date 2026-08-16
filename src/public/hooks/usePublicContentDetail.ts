import { useQuery } from "@tanstack/react-query";
import { publicContentDetailQueryOptions } from "../../features/public-content";
import type { ContentItem, MediaAsset, PublicContentCardItem, PublicContentDetailSnapshot } from "../../types";

export function usePublicContentDetail(input: { slug?: string }) {
  const query = useQuery(publicContentDetailQueryOptions(input.slug, { consumeAbortSignal: false }));
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
