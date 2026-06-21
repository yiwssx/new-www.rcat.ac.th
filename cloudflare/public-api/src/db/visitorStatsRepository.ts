import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { VISITOR_DAILY_STATS_ROW_COLUMNS, type VisitorDailyStatsRow } from "./schema";

export async function listVisitorDailyStatsRows(env: Env): Promise<VisitorDailyStatsRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${VISITOR_DAILY_STATS_ROW_COLUMNS.join(", ")}
       FROM visitor_daily_stats
       ORDER BY day DESC`
    )
    .all<VisitorDailyStatsRow>();

  return result.results ?? [];
}

export async function countOnlineVisitors(env: Env, generatedAt = new Date()): Promise<number> {
  const db = requireD1Database(env);
  const onlineSince = new Date(generatedAt.getTime() - 5 * 60 * 1000).toISOString();
  const result = await db
    .prepare(
      `SELECT COUNT(DISTINCT visitor_id) AS online_users
       FROM visitor_events
       WHERE created_at >= ?`
    )
    .bind(onlineSince)
    .all<{ online_users: number }>();

  return Math.max(0, Number(result.results?.[0]?.online_users) || 0);
}
