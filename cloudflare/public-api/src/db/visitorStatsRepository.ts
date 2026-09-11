import { logD1QueryMetrics } from "../d1QueryMetrics";
import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { VISITOR_DAILY_STATS_ROW_COLUMNS, type VisitorDailyStatsRow } from "./schema";

const ONLINE_VISITOR_WINDOW_MS = 10 * 60 * 1000;

export interface VisitorStatsAggregate {
  totalViews: number;
  todayViews: number;
  usersToday: number;
  usersYesterday: number;
  usersThisMonth: number;
  usersThisYear: number;
  totalUsers: number;
  updatedAt: string;
}

interface VisitorStatsAggregateRow {
  total_views: number | string;
  today_views: number | string;
  users_today: number | string;
  users_yesterday: number | string;
  users_this_month: number | string;
  users_this_year: number | string;
  total_users: number | string;
  updated_at: string;
}

function nonNegativeNumber(value: unknown) {
  return Math.max(0, Number(value) || 0);
}

function getBangkokStatsBoundaries(generatedAt: Date) {
  const bangkokNow = new Date(generatedAt.getTime() + 7 * 60 * 60 * 1000);
  const year = bangkokNow.getUTCFullYear();
  const month = bangkokNow.getUTCMonth();
  const today = bangkokNow.toISOString().slice(0, 10);
  const yesterdayDate = new Date(bangkokNow);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const monthStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const nextMonthStart = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10);
  const yearStart = `${year}-01-01`;
  const nextYearStart = `${year + 1}-01-01`;

  return {
    today,
    yesterday: yesterdayDate.toISOString().slice(0, 10),
    monthStart,
    nextMonthStart,
    yearStart,
    nextYearStart
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

  logD1QueryMetrics(env, "visitor.daily-history", result);
  return result.results ?? [];
}

export async function readVisitorStatsAggregate(env: Env, generatedAt = new Date()): Promise<VisitorStatsAggregate> {
  const boundaries = getBangkokStatsBoundaries(generatedAt);
  const result = await requireD1Database(env)
    .prepare(
      `SELECT
         COALESCE(SUM(total_views), 0) AS total_views,
         COALESCE(SUM(CASE WHEN day = ? THEN total_views ELSE 0 END), 0) AS today_views,
         COALESCE(SUM(CASE WHEN day = ? THEN unique_visitors ELSE 0 END), 0) AS users_today,
         COALESCE(SUM(CASE WHEN day = ? THEN unique_visitors ELSE 0 END), 0) AS users_yesterday,
         COALESCE(SUM(CASE WHEN day >= ? AND day < ? THEN unique_visitors ELSE 0 END), 0) AS users_this_month,
         COALESCE(SUM(CASE WHEN day >= ? AND day < ? THEN unique_visitors ELSE 0 END), 0) AS users_this_year,
         COALESCE(SUM(unique_visitors), 0) AS total_users,
         COALESCE(MAX(updated_at), '') AS updated_at
       FROM visitor_daily_stats`
    )
    .bind(
      boundaries.today,
      boundaries.today,
      boundaries.yesterday,
      boundaries.monthStart,
      boundaries.nextMonthStart,
      boundaries.yearStart,
      boundaries.nextYearStart
    )
    .all<VisitorStatsAggregateRow>();

  logD1QueryMetrics(env, "public.visitor-stats.aggregate", result);
  const row = result.results?.[0];

  return {
    totalViews: nonNegativeNumber(row?.total_views),
    todayViews: nonNegativeNumber(row?.today_views),
    usersToday: nonNegativeNumber(row?.users_today),
    usersYesterday: nonNegativeNumber(row?.users_yesterday),
    usersThisMonth: nonNegativeNumber(row?.users_this_month),
    usersThisYear: nonNegativeNumber(row?.users_this_year),
    totalUsers: nonNegativeNumber(row?.total_users),
    updatedAt: String(row?.updated_at || "")
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

  logD1QueryMetrics(env, "public.visitor-stats.online", result);
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

export function isVisitorPresenceSchemaMissing(error: unknown) {
  return (
    error instanceof Error &&
    /(?:no such table|missing).*visitor_presence|visitor_presence.*(?:not found|missing)/i.test(error.message)
  );
}
