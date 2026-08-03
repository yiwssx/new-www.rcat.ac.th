import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicApiProvider } from "../../config/publicApiProvider";
import { isPublicReadAbortError } from "../../features/public-read/errors";
import { getLiveVisitorStats } from "../../features/visitor-stats";
import type { VisitorStatsSettings } from "../../features/visitor-stats";
import { normalizeVisitorStats } from "../../services/visitorStats";

const LIVE_VISITOR_STATS_INTERVAL_MS = 60_000;
const LIVE_VISITOR_STATS_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
const LIVE_VISITOR_STATS_STALE_MS = 60_000;

export const LIVE_VISITOR_STATS_QUERY_KEY = ["public-visitor-stats-live"] as const;

let liveVisitorStatsBackoffUntil = 0;

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function isLiveVisitorStatsBackedOff() {
  return Date.now() < liveVisitorStatsBackoffUntil;
}

function getLiveVisitorStatsRefetchInterval() {
  const backoffRemaining = liveVisitorStatsBackoffUntil - Date.now();

  return backoffRemaining > 0 ? backoffRemaining : LIVE_VISITOR_STATS_INTERVAL_MS;
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

export function useLiveVisitorStats(initialStats?: VisitorStatsSettings, initialDataUpdatedAt?: number) {
  const normalizedInitial = useMemo(() => normalizeVisitorStats(initialStats), [initialStats]);
  const usesCloudflare = getPublicApiProvider() === "cloudflare";
  const query = useQuery({
    queryKey: LIVE_VISITOR_STATS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      try {
        const live = normalizeVisitorStats(await getLiveVisitorStats({ signal }));
        liveVisitorStatsBackoffUntil = 0;
        return {
          ...normalizedInitial,
          onlineUsers: live.onlineUsers,
          usersToday: live.usersToday,
          totalViews: live.totalViews,
          updatedAt: live.updatedAt
        };
      } catch (error) {
        if (isPublicReadAbortError(error)) {
          throw error;
        }

        liveVisitorStatsBackoffUntil = Date.now() + LIVE_VISITOR_STATS_FAILURE_BACKOFF_MS;
        warnLiveVisitorStatsUnavailable(error);
        throw error;
      }
    },
    enabled: usesCloudflare && Boolean(initialStats?.enabled),
    initialData: initialStats ? normalizedInitial : undefined,
    initialDataUpdatedAt,
    retry: false,
    staleTime: LIVE_VISITOR_STATS_STALE_MS,
    refetchInterval: getLiveVisitorStatsRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnMount: () => !isLiveVisitorStatsBackedOff(),
    refetchOnWindowFocus: () => isDocumentVisible() && !isLiveVisitorStatsBackedOff(),
    refetchOnReconnect: () => isDocumentVisible() && !isLiveVisitorStatsBackedOff()
  });

  return query.data ?? normalizedInitial;
}
