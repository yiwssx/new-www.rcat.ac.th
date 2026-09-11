import type { PublicVisitorStatsSnapshotContract } from "../contracts/publicVisitorStats";
import type { VisitorStatsAggregate } from "../db/visitorStatsRepository";
import type { VisitorDailyStatsRow } from "../db/schema";

function toNonNegativeNumber(value: unknown) {
  return Math.max(0, Number(value) || 0);
}

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
  const total = rows.reduce((sum, row) => sum + toNonNegativeNumber(row.total_views), 0);
  const todayRow = rows.find((row) => row.day === today);
  const totalUsers = rows.reduce((sum, row) => sum + toNonNegativeNumber(row.unique_visitors), 0);
  const updatedAt = rows.reduce(
    (latest, row) => (row.updated_at && row.updated_at > latest ? row.updated_at : latest),
    ""
  );

  return {
    total,
    today: toNonNegativeNumber(todayRow?.total_views),
    enabled: true,
    usersToday: toNonNegativeNumber(todayRow?.unique_visitors),
    usersYesterday: rows
      .filter((row) => row.day === yesterday)
      .reduce((sum, row) => sum + toNonNegativeNumber(row.unique_visitors), 0),
    usersThisMonth: rows
      .filter((row) => row.day.startsWith(monthPrefix))
      .reduce((sum, row) => sum + toNonNegativeNumber(row.unique_visitors), 0),
    usersThisYear: rows
      .filter((row) => row.day.startsWith(yearPrefix))
      .reduce((sum, row) => sum + toNonNegativeNumber(row.unique_visitors), 0),
    totalUsers,
    totalViews: total,
    onlineUsers: toNonNegativeNumber(currentOnlineUsers ?? todayRow?.online_users),
    updatedAt: updatedAt || generatedAt.toISOString(),
    generatedAt: generatedAt.toISOString()
  };
}

export function createPublicVisitorStatsSnapshotFromAggregate(
  aggregate: VisitorStatsAggregate,
  generatedAt = new Date(),
  currentOnlineUsers = 0
): PublicVisitorStatsSnapshotContract {
  return {
    total: toNonNegativeNumber(aggregate.total),
    today: toNonNegativeNumber(aggregate.today),
    enabled: true,
    usersToday: toNonNegativeNumber(aggregate.usersToday),
    usersYesterday: toNonNegativeNumber(aggregate.usersYesterday),
    usersThisMonth: toNonNegativeNumber(aggregate.usersThisMonth),
    usersThisYear: toNonNegativeNumber(aggregate.usersThisYear),
    totalUsers: toNonNegativeNumber(aggregate.totalUsers),
    totalViews: toNonNegativeNumber(aggregate.total),
    onlineUsers: toNonNegativeNumber(currentOnlineUsers),
    updatedAt: aggregate.updatedAt || generatedAt.toISOString(),
    generatedAt: generatedAt.toISOString()
  };
}
