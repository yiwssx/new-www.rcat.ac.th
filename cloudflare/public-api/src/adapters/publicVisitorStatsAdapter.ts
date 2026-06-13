import type { PublicVisitorStatsSnapshotContract } from "../contracts/publicVisitorStats";
import type { VisitorDailyStatsRow } from "../db/schema";

export function createPublicVisitorStatsSnapshot(
  rows: VisitorDailyStatsRow[],
  generatedAt = new Date()
): PublicVisitorStatsSnapshotContract {
  const today = generatedAt.toISOString().slice(0, 10);
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.total_views) || 0), 0);
  const todayRow = rows.find((row) => row.day === today);

  return {
    total,
    today: Math.max(0, Number(todayRow?.total_views) || 0),
    generatedAt: generatedAt.toISOString()
  };
}
