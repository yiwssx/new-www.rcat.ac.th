import { requireD1Database } from "./db/documentsRepository";
import type { Env } from "./env";

const DAY_MS = 24 * 60 * 60 * 1000;
const RAW_EVENT_RETENTION_DAYS = 90;
const PRESENCE_RETENTION_DAYS = 2;

export function getPublicAnalyticsRetentionCutoffs(now = new Date()) {
  return {
    now: now.toISOString(),
    rawEventCutoff: new Date(now.getTime() - RAW_EVENT_RETENTION_DAYS * DAY_MS).toISOString(),
    presenceCutoff: new Date(now.getTime() - PRESENCE_RETENTION_DAYS * DAY_MS).toISOString()
  };
}

export async function prunePublicAnalyticsData(env: Env, now = new Date()) {
  if (!env.DB) {
    return;
  }

  const db = requireD1Database(env);
  const cutoffs = getPublicAnalyticsRetentionCutoffs(now);

  await db.batch([
    db.prepare("DELETE FROM public_write_rate_limits WHERE expires_at < ?").bind(cutoffs.now),
    db.prepare("DELETE FROM visitor_presence WHERE last_seen_at < ?").bind(cutoffs.presenceCutoff),
    db.prepare("DELETE FROM visitor_events WHERE created_at < ?").bind(cutoffs.rawEventCutoff),
    db.prepare("DELETE FROM content_view_events WHERE created_at < ?").bind(cutoffs.rawEventCutoff)
  ]);
}
