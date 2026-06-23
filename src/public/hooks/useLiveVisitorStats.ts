import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicApiProvider } from "../../config/publicApiProvider";
import { getLiveVisitorStats } from "../../features/visitor-stats";
import type { VisitorStatsSettings } from "../../features/visitor-stats";
import { normalizeVisitorStats } from "../../services/visitorStats";

const LIVE_VISITOR_STATS_INTERVAL_MS = 20_000;

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function useLiveVisitorStats(initialStats?: VisitorStatsSettings) {
  const normalizedInitial = useMemo(() => normalizeVisitorStats(initialStats), [initialStats]);
  const usesCloudflare = getPublicApiProvider() === "cloudflare";
  const query = useQuery({
    queryKey: ["public-visitor-stats-live"],
    queryFn: async () => {
      const live = normalizeVisitorStats(await getLiveVisitorStats());
      return {
        ...normalizedInitial,
        onlineUsers: live.onlineUsers,
        usersToday: live.usersToday,
        totalViews: live.totalViews,
        updatedAt: live.updatedAt
      };
    },
    enabled: usesCloudflare && Boolean(initialStats?.enabled),
    staleTime: 0,
    refetchInterval: () => (isDocumentVisible() ? LIVE_VISITOR_STATS_INTERVAL_MS : false),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  return query.data ?? normalizedInitial;
}
