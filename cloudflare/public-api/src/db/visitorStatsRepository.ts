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
