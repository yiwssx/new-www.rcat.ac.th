import type { VisitorStatsSettings } from "../features/visitor-stats";

export const DEFAULT_VISITOR_STATS: VisitorStatsSettings = {
  enabled: false,
  usersToday: 0,
  usersYesterday: 0,
  usersThisMonth: 0,
  usersThisYear: 0,
  totalUsers: 0,
  totalViews: 0,
  onlineUsers: 0,
  updatedAt: ""
};

function normalizeCount(value: unknown) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.floor(numeric));
}

export function normalizeVisitorStats(input?: Partial<VisitorStatsSettings> | null): VisitorStatsSettings {
  const source = input && typeof input === "object" ? input : {};

  return {
    enabled: source.enabled === true,
    usersToday: normalizeCount(source.usersToday),
    usersYesterday: normalizeCount(source.usersYesterday),
    usersThisMonth: normalizeCount(source.usersThisMonth),
    usersThisYear: normalizeCount(source.usersThisYear),
    totalUsers: normalizeCount(source.totalUsers),
    totalViews: normalizeCount(source.totalViews),
    onlineUsers: normalizeCount(source.onlineUsers),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt.trim() : ""
  };
}
