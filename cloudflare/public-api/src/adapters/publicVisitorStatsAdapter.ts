import type { PublicVisitorStatsSnapshotContract } from "../contracts/publicVisitorStats";
import type { VisitorStatsAggregate } from "../db/visitorStatsRepository";
import type { VisitorDailyStatsRow } from "../db/schema";

export function createPublicVisitorStatsSnapshot(
  rows: VisitorDailyStatsRow[],
  generatedAt = new Date(),
  currentOnlineUsers?: number
): PublicVisitorStatsSnapshotContract {
  const bangkokNow = new Date(generatedAt.getTime() + 7 * 60 * 60 * 1000);
  const today = bangkokNow.toISOString().slice(0, 10);
  const yesterdayDate = new Date(bangkokNow);
  yesterdayDate.setUTCDate(bangkokNow.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  const yearPrefix = today.slice(0, 4);
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.total_views) || 0), 0);
  const todayRow = rows.find((row) => row.day === today);
  const totalUsers = rows.reduce((sum, row) => sum + Math.max(0, Number(row.unique_visitors) || 0), 0);
  const updatedAt = rows.reduce(
    (latest, row) => (row.updated_at && row.updated_at > latest ? row.updated_at : latest),
    ""
  );

  return {
    total,
    today: Math.max(0, Number(todayRow?.total_views) || 0),
    enabled: true,
    usersToday: Math.max(0, Number(todayRow?.unique_visitors) || 0),
    usersYesterday: rows
      .filter((row) => row.day === yesterday)
      .reduce((sum, row) => sum + Math.max(0, Number(row.unique_visitors) || 0), 0),
    usersThisMonth: rows
      .filter((row) => row.day.startsWith(monthPrefix))
      .reduce((sum, row) => sum + Math.max(0, Number(row.unique_visitors) || 0), 0),
    usersThisYear: rows
      .filter((row) => row.day.startsWith(yearPrefix))
      .reduce((sum, row) => sum + Math.max(0, Number(row.unique_visitors) || 0), 0),
    totalUsers,
    totalViews: total,
    onlineUsers: Math.max(0, Number(currentOnlineUsers ?? todayRow?.online_users) || 0),
    updatedAt: updatedAt || generatedAt.toISOString(),
    generatedAt: generatedAt.toISOString()
  };
}

export function createPublicVisitorStatsSnapshotFromAggregate(
  aggregate: VisitorStatsAggregate,
  generatedAt = new Date(),
  currentOnlineUsers = 0
): PublicVisitorStatsSnapshotContract {
  const totalViews = Math.max(0, Number(aggregate.totalViews) || 0);

  return {
    total: totalViews,
    today: Math.max(0, Number(aggregate.todayViews) || 0),
    enabled: true,
    usersToday: Math.max(0, Number(aggregate.usersToday) || 0),
    usersYesterday: Math.max(0, Number(aggregate.usersYesterday) || 0),
    usersThisMonth: Math.max(0, Number(aggregate.usersThisMonth) || 0),
    usersThisYear: Math.max(0, Number(aggregate.usersThisYear) || 0),
    totalUsers: Math.max(0, Number(aggregate.totalUsers) || 0),
    totalViews,
    onlineUsers: Math.max(0, Number(currentOnlineUsers) || 0),
    updatedAt: aggregate.updatedAt || generatedAt.toISOString(),
    generatedAt: generatedAt.toISOString()
  };
}
