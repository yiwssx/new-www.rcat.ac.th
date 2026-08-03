import { queryOptions } from "@tanstack/react-query";
import { getPublicHomeSnapshot } from "../public-home/api";
import type { CmsSnapshot, ContentItem } from "../../types";
import { PUBLIC_SNAPSHOT_CACHE_TTL_MS, setPublicSnapshotCache } from "../../services/publicCmsCache";
import type { PublicReadRequestOptions } from "./request";
import { getPublicQueryRequestOptions, PUBLIC_QUERY_GC_TIME_MS, type PublicQueryRuntimeOptions } from "./queryPolicy";

export const publicCmsSnapshotQueryKey = ["cms-snapshot"] as const;

export async function getPublicCmsSnapshotForProvider(options: PublicReadRequestOptions = {}): Promise<CmsSnapshot> {
  const home = await getPublicHomeSnapshot(options);
  const contentById = new Map<string, ContentItem>();

  [
    ...home.latestNews,
    ...home.latestAnnouncements,
    ...home.procurementItems,
    ...home.jobOpportunityItems,
    ...home.achievementItems,
    ...home.programItems
  ].forEach((item) => contentById.set(item.id, item));

  return {
    metrics: [],
    content: [...contentById.values()],
    media: home.media,
    events: home.eventItems,
    menu: home.menu,
    carouselSlides: home.carouselSlides,
    externalServices: home.externalServices,
    displaySettings: home.displaySettings,
    siteSettings: home.siteSettings,
    homepageSettings: home.homepageSettings,
    visitorStats: home.visitorStats
  };
}

export function publicCmsSnapshotQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicCmsSnapshotQueryKey,
    queryFn: async (context) => {
      const snapshot = await getPublicCmsSnapshotForProvider(getPublicQueryRequestOptions(context, runtimeOptions));
      setPublicSnapshotCache(snapshot);
      return snapshot;
    },
    staleTime: PUBLIC_SNAPSHOT_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
