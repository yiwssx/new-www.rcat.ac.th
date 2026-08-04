import { useEffect, useMemo } from "react";
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
let liveVisitorStatsLastNetworkAt = 0;
let liveVisitorStatsLastNetworkValue: VisitorStatsSettings | undefined;
let liveVisitorStatsInFlight: Promise<VisitorStatsSettings> | null = null;

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function isLiveVisitorStatsBackedOff() {
  return Date.now() < liveVisitorStatsBackoffUntil;
}

function getLiveVisitorStatsPollDelay() {
  const backoffRemaining = liveVisitorStatsBackoffUntil - Date.now();

  return backoffRemaining > 0 ? backoffRemaining : LIVE_VISITOR_STATS_INTERVAL_MS;
}

function shouldRefreshLiveVisitorStats(query: { state: { dataUpdatedAt: number } }) {
  if (!isDocumentVisible() || isLiveVisitorStatsBackedOff()) {
    return false;
  }

  const dataUpdatedAt = Number(query.state.dataUpdatedAt || 0);
  return dataUpdatedAt <= 0 || Date.now() - dataUpdatedAt >= LIVE_VISITOR_STATS_STALE_MS;
}

function isWithinLiveVisitorStatsNetworkBudget(now = Date.now()) {
  return liveVisitorStatsLastNetworkAt > 0 && now - liveVisitorStatsLastNetworkAt < LIVE_VISITOR_STATS_INTERVAL_MS;
}

function mergeLiveVisitorStats(initial: VisitorStatsSettings, live: VisitorStatsSettings) {
  return {
    ...initial,
    onlineUsers: live.onlineUsers,
    usersToday: live.usersToday,
    totalViews: live.totalViews,
    updatedAt: live.updatedAt
  };
}

async function readLiveVisitorStatsWithinBudget(signal: AbortSignal | undefined) {
  if (liveVisitorStatsInFlight) {
    return liveVisitorStatsInFlight;
  }

  if (isWithinLiveVisitorStatsNetworkBudget() && liveVisitorStatsLastNetworkValue) {
    return liveVisitorStatsLastNetworkValue;
  }

  liveVisitorStatsLastNetworkAt = Date.now();
  const request = getLiveVisitorStats({ signal }).then((stats) => normalizeVisitorStats(stats));
  liveVisitorStatsInFlight = request;

  try {
    const live = await request;
    liveVisitorStatsBackoffUntil = 0;
    liveVisitorStatsLastNetworkValue = live;
    return live;
  } catch (error) {
    if (!isPublicReadAbortError(error)) {
      liveVisitorStatsBackoffUntil = Date.now() + LIVE_VISITOR_STATS_FAILURE_BACKOFF_MS;
    }
    throw error;
  } finally {
    if (liveVisitorStatsInFlight === request) {
      liveVisitorStatsInFlight = null;
    }
  }
}

function warnLiveVisitorStatsUnavailable(error: unknown) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.warn("Live visitor stats are temporarily unavailable; keeping the public snapshot.", error);
}

export function resetLiveVisitorStatsBackoffForTests() {
  liveVisitorStatsBackoffUntil = 0;
  liveVisitorStatsLastNetworkAt = 0;
  liveVisitorStatsLastNetworkValue = undefined;
  liveVisitorStatsInFlight = null;
}

export function useLiveVisitorStats(initialStats?: VisitorStatsSettings, initialDataUpdatedAt?: number) {
  const normalizedInitial = useMemo(() => normalizeVisitorStats(initialStats), [initialStats]);
  const usesCloudflare = getPublicApiProvider() === "cloudflare";
  const isBrowser = typeof window !== "undefined";
  const liveEnabled = isBrowser && usesCloudflare && Boolean(initialStats?.enabled);
  const query = useQuery({
    queryKey: LIVE_VISITOR_STATS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      try {
        const live = await readLiveVisitorStatsWithinBudget(signal);
        return mergeLiveVisitorStats(normalizedInitial, live);
      } catch (error) {
        if (isPublicReadAbortError(error)) {
          throw error;
        }

        warnLiveVisitorStatsUnavailable(error);
        throw error;
      }
    },
    enabled: liveEnabled,
    initialData: initialStats ? normalizedInitial : undefined,
    initialDataUpdatedAt,
    retry: false,
    staleTime: LIVE_VISITOR_STATS_STALE_MS,
    refetchInterval: false,
    refetchOnMount: () => !isLiveVisitorStatsBackedOff(),
    refetchOnWindowFocus: shouldRefreshLiveVisitorStats,
    refetchOnReconnect: shouldRefreshLiveVisitorStats
  });
  const refetch = query.refetch;

  useEffect(() => {
    if (!liveEnabled || typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const scheduleNextPoll = () => {
      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(async () => {
        if (cancelled) {
          return;
        }

        if (isDocumentVisible() && !isLiveVisitorStatsBackedOff()) {
          await refetch({ cancelRefetch: false });
        }

        scheduleNextPoll();
      }, getLiveVisitorStatsPollDelay());
    };

    scheduleNextPoll();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [liveEnabled, refetch]);

  return query.data ?? normalizedInitial;
}
