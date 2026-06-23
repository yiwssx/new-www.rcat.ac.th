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
       FROM visitor_presence
       WHERE last_seen_at >= ?`
    )
    .bind(onlineSince)
    .all<{ online_users: number }>();

  return Math.max(0, Number(result.results?.[0]?.online_users) || 0);
}

export async function upsertVisitorPresence(
  env: Env,
  input: { visitorId: string; day: string; path: string; seenAt: string }
) {
  const db = requireD1Database(env);
  const presenceId = `presence-${input.day}-${input.visitorId}`;

  await db
    .prepare(
      `INSERT INTO visitor_presence (id, visitor_id, day, path, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, visitor_id) DO UPDATE SET
         path = excluded.path,
         last_seen_at = excluded.last_seen_at`
    )
    .bind(presenceId, input.visitorId, input.day, input.path, input.seenAt, input.seenAt)
    .run();
}

export async function updateDailyOnlineVisitors(env: Env, day: string, onlineUsers: number, updatedAt: string) {
  const db = requireD1Database(env);

  await db
    .prepare(
      `INSERT INTO visitor_daily_stats
         (day, total_views, unique_visitors, online_users, updated_at, created_at, updated_by, revision)
       VALUES (?, 0, 0, ?, ?, ?, 'public-presence', 0)
       ON CONFLICT(day) DO UPDATE SET
         online_users = excluded.online_users,
         updated_at = excluded.updated_at,
         updated_by = 'public-presence',
         revision = visitor_daily_stats.revision + 1`
    )
    .bind(day, onlineUsers, updatedAt, updatedAt)
    .run();
}

export function isVisitorPresenceSchemaMissing(error: unknown) {
  return (
    error instanceof Error &&
    /(?:no such table|missing).*visitor_presence|visitor_presence.*(?:not found|missing)/i.test(error.message)
  );
}
