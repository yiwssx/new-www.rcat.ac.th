import { getPublishedContentRowBySlug } from "../db/contentRepository";
import { requireD1Database } from "../db/documentsRepository";
import {
  countOnlineVisitors,
  isVisitorPresenceSchemaMissing,
  updateDailyOnlineVisitors,
  upsertVisitorPresence
} from "../db/visitorStatsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const VISITOR_ID_PATTERN = /^rcat_[A-Za-z0-9_-]{12,64}$/;
const MAX_PATH_LENGTH = 240;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readBody(request: Request) {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

function getBangkokDay(now: Date) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function hashDailyVisitorId(visitorId: string, day: string) {
  const bytes = new TextEncoder().encode(`${day}:${visitorId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `v1_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)}`;
}

function visitorPresenceSchemaError(resource: string) {
  return jsonError("visitor presence schema is not available", 503, {
    resource,
    diagnostic: "visitor-presence-schema-missing-v1",
    suggestedMigration: "run D1 migrations"
  });
}

function parseVisitorInput(body: Record<string, unknown>) {
  const visitorId = typeof body.visitorId === "string" ? body.visitorId.trim() : "";
  const path = typeof body.path === "string" ? body.path.trim().slice(0, MAX_PATH_LENGTH) : "";

  return VISITOR_ID_PATTERN.test(visitorId) && path.startsWith("/") ? { visitorId, path } : null;
}

async function refreshVisitorPresence(env: Env, visitorId: string, path: string, now: Date) {
  const seenAt = now.toISOString();
  const day = getBangkokDay(now);
  const dailyVisitorId = await hashDailyVisitorId(visitorId, day);

  await upsertVisitorPresence(env, { visitorId: dailyVisitorId, day, path, seenAt });
  const onlineUsers = await countOnlineVisitors(env, now);
  return { day, dailyVisitorId, onlineUsers, seenAt };
}

export async function recordPublicPresence(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, { resource: "presence" });
  }

  const input = parseVisitorInput((await readBody(request)) ?? {});

  if (!input) {
    return jsonError("invalid presence", 400, { resource: "presence" });
  }

  try {
    const presence = await refreshVisitorPresence(env, input.visitorId, input.path, new Date());
    await updateDailyOnlineVisitors(env, presence.day, presence.onlineUsers, presence.seenAt);
    return json({ recorded: true, day: presence.day, onlineUsers: presence.onlineUsers });
  } catch (error) {
    if (isVisitorPresenceSchemaMissing(error)) {
      return visitorPresenceSchemaError("presence");
    }

    throw error;
  }
}

export async function recordPublicSiteView(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, { resource: "site-view" });
  }

  const body = (await readBody(request)) ?? {};
  const input = parseVisitorInput(body);

  if (!input) {
    return jsonError("invalid site view", 400, { resource: "site-view" });
  }

  const db = requireD1Database(env);
  const now = new Date();
  const createdAt = now.toISOString();
  const day = getBangkokDay(now);
  let dailyVisitorId: string;
  let onlineUsers: number;

  try {
    const presence = await refreshVisitorPresence(env, input.visitorId, input.path, now);
    dailyVisitorId = presence.dailyVisitorId;
    onlineUsers = presence.onlineUsers;
  } catch (error) {
    if (isVisitorPresenceSchemaMissing(error)) {
      return visitorPresenceSchemaError("site-view");
    }

    throw error;
  }
  const existingVisitor = await db
    .prepare("SELECT id FROM visitor_events WHERE visitor_id = ? LIMIT 1")
    .bind(dailyVisitorId)
    .first<{ id: string }>();
  const uniqueIncrement = existingVisitor ? 0 : 1;
  const eventId = `site-view-${crypto.randomUUID()}`;
  const referrerOrigin = typeof body.referrerOrigin === "string" ? body.referrerOrigin.slice(0, 120) : "";
  const pageTitle = typeof body.pageTitle === "string" ? body.pageTitle.slice(0, 120) : "";

  await db
    .prepare(
      `INSERT INTO visitor_events (id, visitor_id, path, referrer_origin, page_title, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(eventId, dailyVisitorId, input.path, referrerOrigin, pageTitle, createdAt)
    .run();
  await db
    .prepare(
      `INSERT INTO visitor_daily_stats
         (day, total_views, unique_visitors, online_users, updated_at, created_at, updated_by, revision)
       VALUES (?, 1, ?, ?, ?, ?, 'public-site-view', 0)
       ON CONFLICT(day) DO UPDATE SET
         total_views = visitor_daily_stats.total_views + 1,
         unique_visitors = visitor_daily_stats.unique_visitors + excluded.unique_visitors,
         online_users = excluded.online_users,
         updated_at = excluded.updated_at,
         updated_by = 'public-site-view',
         revision = visitor_daily_stats.revision + 1`
    )
    .bind(day, uniqueIncrement, onlineUsers, createdAt, createdAt)
    .run();

  return json({ recorded: true, day, onlineUsers }, { status: 201 });
}

export async function recordPublicContentView(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, { resource: "content-view" });
  }

  const body = (await readBody(request)) ?? {};
  const identifier =
    typeof body?.slug === "string" ? body.slug.trim() : typeof body?.id === "string" ? body.id.trim() : "";

  if (!identifier) {
    return jsonError("content id or slug is required", 400, { resource: "content-view" });
  }

  const row = await getPublishedContentRowBySlug(env, identifier);

  if (!row) {
    return jsonError("not found", 404, { resource: "content-view" });
  }

  const db = requireD1Database(env);
  const now = new Date();
  const createdAt = now.toISOString();
  const day = getBangkokDay(now);
  const eventId = `content-view-${crypto.randomUUID()}`;

  await db.batch([
    db
      .prepare("INSERT INTO content_view_events (id, content_id, slug, created_at) VALUES (?, ?, ?, ?)")
      .bind(eventId, row.id, row.slug, createdAt),
    db
      .prepare(
        `INSERT INTO content_view_daily_stats (day, content_id, slug, view_count, updated_at)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(day, content_id) DO UPDATE SET
           view_count = content_view_daily_stats.view_count + 1,
           updated_at = excluded.updated_at`
      )
      .bind(day, row.id, row.slug, createdAt),
    db
      .prepare(
        `UPDATE contents
         SET view_count = view_count + 1, last_viewed_at = ?
         WHERE id = ? AND status = 'published' AND COALESCE(deleted_at, '') = ''`
      )
      .bind(createdAt, row.id)
  ]);

  return json({
    id: row.id,
    slug: row.slug,
    viewCount: Math.max(0, Number(row.view_count) || 0) + 1,
    lastViewedAt: createdAt
  });
}
