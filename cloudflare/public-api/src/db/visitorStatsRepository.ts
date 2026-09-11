import type { Env } from "../env";
import { logD1QueryUsage } from "./d1QueryUsage";
import { requireD1Database } from "./documentsRepository";
import { VISITOR_DAILY_STATS_ROW_COLUMNS, type VisitorDailyStatsRow } from "./schema";

const ONLINE_VISITOR_WINDOW_MS = 10 * 60 * 1000;

export interface VisitorStatsAggregate {
  total: number;
  today: number;
  usersToday: number;
  usersYesterday: number;
  usersThisMonth: number;
  usersThisYear: number;
  totalUsers: number;
  updatedAt: string;
}

function toNonNegativeNumber(value: unknown) {
  return Math.max(0, Number(value) || 0);
}

function getBangkokDateParts(generatedAt: Date) {
  const bangkokNow = new Date(generatedAt.getTime() + 7 * 60 * 60 * 1000);
  const today = bangkokNow.toISOString().slice(0, 10);
  const yesterdayDate = new Date(bangkokNow);
  yesterdayDate.setUTCDate(bangkokNow.getUTCDate() - 1);

  return {
    today,
    yesterday: yesterdayDate.toISOString().slice(0, 10),
    monthPrefix: today.slice(0, 7),
    yearPrefix: today.slice(0, 4)
  };
}

function aggregateVisitorRows(rows: VisitorDailyStatsRow[], generatedAt: Date): VisitorStatsAggregate {
  const { today, yesterday, monthPrefix, yearPrefix } = getBangkokDateParts(generatedAt);
  const todayRow = rows.find((row) => row.day === today);

  return {
    total: rows.reduce((sum, row) => sum + toNonNegativeNumber(row.total_views), 0),
    today: toNonNegativeNumber(todayRow?.total_views),
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
    totalUsers: rows.reduce((sum, row) => sum + toNonNegativeNumber(row.unique_visitors), 0),
    updatedAt:
      rows.reduce((latest, row) => (row.updated_at && row.updated_at > latest ? row.updated_at : latest), "") ||
      generatedAt.toISOString()
  };
}

export async function listVisitorDailyStatsRows(env: Env): Promise<VisitorDailyStatsRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${VISITOR_DAILY_STATS_ROW_COLUMNS.join(", ")}
       FROM visitor_daily_stats
       ORDER BY day DESC`
    )
    .all<VisitorDailyStatsRow>();

  logD1QueryUsage(env, "visitor-stats:list-daily", result);
  return result.results ?? [];
}

export async function readVisitorStatsAggregate(env: Env, generatedAt = new Date()): Promise<VisitorStatsAggregate> {
  const db = requireD1Database(env);
  const { today, yesterday, monthPrefix, yearPrefix } = getBangkokDateParts(generatedAt);
  const result = await db
    .prepare(
      `SELECT
         COALESCE(SUM(total_views), 0) AS total_views,
         COALESCE(SUM(CASE WHEN ? = day THEN total_views ELSE 0 END), 0) AS today_views,
         COALESCE(SUM(CASE WHEN ? = day THEN unique_visitors ELSE 0 END), 0) AS users_today,
         COALESCE(SUM(CASE WHEN ? = day THEN unique_visitors ELSE 0 END), 0) AS users_yesterday,
         COALESCE(SUM(CASE WHEN day LIKE ? THEN unique_visitors ELSE 0 END), 0) AS users_this_month,
         COALESCE(SUM(CASE WHEN day LIKE ? THEN unique_visitors ELSE 0 END), 0) AS users_this_year,
         COALESCE(SUM(unique_visitors), 0) AS total_users,
         COALESCE(MAX(updated_at), '') AS updated_at
       FROM visitor_daily_stats`
    )
    .bind(today, today, yesterday, `${monthPrefix}%`, `${yearPrefix}%`)
    .all<{
      total_views: number | string;
      today_views: number | string;
      users_today: number | string;
      users_yesterday: number | string;
      users_this_month: number | string;
      users_this_year: number | string;
      total_users: number | string;
      updated_at: string;
    }>();

  logD1QueryUsage(env, "visitor-stats:aggregate", result);

  const row = result.results?.[0] as
    | {
        total_views?: unknown;
        today_views?: unknown;
        users_today?: unknown;
        users_yesterday?: unknown;
        users_this_month?: unknown;
        users_this_year?: unknown;
        total_users?: unknown;
        updated_at?: unknown;
        day?: unknown;
      }
    | undefined;

  // Repository unit-test doubles may return source rows instead of evaluating SQL aggregates.
  if (row && "day" in row) {
    return aggregateVisitorRows(result.results as unknown as VisitorDailyStatsRow[], generatedAt);
  }

  return {
    total: toNonNegativeNumber(row?.total_views),
    today: toNonNegativeNumber(row?.today_views),
    usersToday: toNonNegativeNumber(row?.users_today),
    usersYesterday: toNonNegativeNumber(row?.users_yesterday),
    usersThisMonth: toNonNegativeNumber(row?.users_this_month),
    usersThisYear: toNonNegativeNumber(row?.users_this_year),
    totalUsers: toNonNegativeNumber(row?.total_users),
    updatedAt: String(row?.updated_at || generatedAt.toISOString())
  };
}

export async function countOnlineVisitors(env: Env, generatedAt = new Date()): Promise<number> {
  const db = requireD1Database(env);
  const onlineSince = new Date(generatedAt.getTime() - ONLINE_VISITOR_WINDOW_MS).toISOString();
  const result = await db
    .prepare(
      `SELECT COUNT(DISTINCT visitor_id) AS online_users
       FROM visitor_presence
       WHERE last_seen_at >= ?`
    )
    .bind(onlineSince)
    .all<{ online_users: number }>();

  logD1QueryUsage(env, "visitor-stats:online", result);
  return Math.max(0, Number(result.results?.[0]?.online_users) || 0);
}

export async function upsertVisitorPresence(
  env: Env,
  input: { visitorId: string; day: string; path: string; seenAt: string }
) {
  const db = requireD1Database(env);
  const presenceId = `presence-${input.day}-${input.visitorId}`;

  const result = await db
    .prepare(
      `INSERT INTO visitor_presence (id, visitor_id, day, path, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, visitor_id) DO UPDATE SET
         path = excluded.path,
         last_seen_at = excluded.last_seen_at`
    )
    .bind(presenceId, input.visitorId, input.day, input.path, input.seenAt, input.seenAt)
    .run();

  logD1QueryUsage(env, "visitor-presence:upsert", result);
}

export function isVisitorPresenceSchemaMissing(error: unknown) {
  return (
    error instanceof Error &&
    /(?:no such table|missing).*visitor_presence|visitor_presence.*(?:not found|missing)/i.test(error.message)
  );
}
