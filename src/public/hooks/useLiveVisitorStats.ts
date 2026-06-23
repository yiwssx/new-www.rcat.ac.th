import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicApiProvider } from "../../config/publicApiProvider";
import { getLiveVisitorStats } from "../../features/visitor-stats";
import type { VisitorStatsSettings } from "../../features/visitor-stats";
import { normalizeVisitorStats } from "../../services/visitorStats";

const LIVE_VISITOR_STATS_INTERVAL_MS = 20_000;
const LIVE_VISITOR_STATS_FAILURE_BACKOFF_MS = 5 * 60 * 1000;

let liveVisitorStatsBackoffUntil = 0;

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function isLiveVisitorStatsBackedOff() {
  return Date.now() < liveVisitorStatsBackoffUntil;
}

function warnLiveVisitorStatsUnavailable(error: unknown) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.warn("Live visitor stats are temporarily unavailable; keeping the public snapshot.", error);
}

export function resetLiveVisitorStatsBackoffForTests() {
  liveVisitorStatsBackoffUntil = 0;
}

export function useLiveVisitorStats(initialStats?: VisitorStatsSettings) {
  const normalizedInitial = useMemo(() => normalizeVisitorStats(initialStats), [initialStats]);
  const usesCloudflare = getPublicApiProvider() === "cloudflare";
  const query = useQuery({
    queryKey: ["public-visitor-stats-live"],
    queryFn: async () => {
      try {
        const live = normalizeVisitorStats(await getLiveVisitorStats());
        liveVisitorStatsBackoffUntil = 0;
        return {
          ...normalizedInitial,
          onlineUsers: live.onlineUsers,
          usersToday: live.usersToday,
          totalViews: live.totalViews,
          updatedAt: live.updatedAt
        };
      } catch (error) {
        liveVisitorStatsBackoffUntil = Date.now() + LIVE_VISITOR_STATS_FAILURE_BACKOFF_MS;
        warnLiveVisitorStatsUnavailable(error);
        throw error;
      }
    },
    enabled: usesCloudflare && Boolean(initialStats?.enabled),
    retry: false,
    staleTime: 0,
    refetchInterval: () =>
      isDocumentVisible() && !isLiveVisitorStatsBackedOff() ? LIVE_VISITOR_STATS_INTERVAL_MS : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  return query.data ?? normalizedInitial;
}
