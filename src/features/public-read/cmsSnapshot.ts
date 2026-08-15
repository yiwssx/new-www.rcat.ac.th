import { queryOptions } from "@tanstack/react-query";
import { getPublicHomeSnapshot } from "../public-home/api";
import { getPublicShellSnapshot } from "../public-shell/api";
import type { CmsSnapshot, ContentItem, PublicContentCardItem } from "../../types";
import { PUBLIC_SNAPSHOT_CACHE_TTL_MS, setPublicSnapshotCache } from "../../services/publicCmsCache";
import type { PublicReadRequestOptions } from "./request";
import { getPublicQueryRequestOptions, PUBLIC_QUERY_GC_TIME_MS, type PublicQueryRuntimeOptions } from "./queryPolicy";

export const publicCmsSnapshotQueryKey = ["cms-snapshot"] as const;

function cardToLegacyContentItem(item: PublicContentCardItem): ContentItem {
  return {
    ...item,
    updatedAt: item.publishAt
  };
}

export async function getPublicCmsSnapshotForProvider(options: PublicReadRequestOptions = {}): Promise<CmsSnapshot> {
  const [home, shell] = await Promise.all([getPublicHomeSnapshot(options), getPublicShellSnapshot(options)]);
  const contentById = new Map<string, ContentItem>();

  [
    ...home.latestNews,
    ...home.latestAnnouncements,
    ...home.procurementItems,
    ...home.jobOpportunityItems,
    ...home.achievementItems,
    ...home.programItems
  ].forEach((item) => contentById.set(item.id, cardToLegacyContentItem(item)));

  return {
    metrics: [],
    content: [...contentById.values()],
    media: home.media,
    events: home.eventItems,
    menu: shell.menu,
    carouselSlides: home.carouselSlides,
    externalServices: home.externalServices,
    displaySettings: shell.displaySettings,
    siteSettings: shell.siteSettings,
    homepageSettings: shell.homepageSettings,
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
