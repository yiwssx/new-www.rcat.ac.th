import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicHomeSnapshot } from "../../features/public-home";
import type { CmsSnapshot, ContentItem } from "../../types";
import {
  getPublicSnapshotCache,
  PUBLIC_SNAPSHOT_CACHE_TTL_MS,
  setPublicSnapshotCache
} from "../../services/publicCmsCache";

const publicQueryGcTimeMs = 60 * 60 * 1000;

interface UsePublicCmsSnapshotOptions {
  enabled?: boolean;
}

function isFresh(savedAt: number, ttlMs: number) {
  return savedAt + ttlMs > Date.now();
}

export function usePublicCmsSnapshot(options: UsePublicCmsSnapshotOptions = {}) {
  const enabled = options.enabled ?? true;
  const cachedSnapshot = useMemo(() => getPublicSnapshotCache(), []);
  const hasFreshCache = cachedSnapshot ? isFresh(cachedSnapshot.savedAt, PUBLIC_SNAPSHOT_CACHE_TTL_MS) : false;

  return useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: async () => {
      const snapshot = await getPublicCmsSnapshotForProvider();
      setPublicSnapshotCache(snapshot);
      return snapshot;
    },
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    enabled,
    staleTime: PUBLIC_SNAPSHOT_CACHE_TTL_MS,
    gcTime: publicQueryGcTimeMs,
    refetchOnMount: enabled && (cachedSnapshot ? !hasFreshCache : true),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}

export async function getPublicCmsSnapshotForProvider(): Promise<CmsSnapshot> {
  const home = await getPublicHomeSnapshot();
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
