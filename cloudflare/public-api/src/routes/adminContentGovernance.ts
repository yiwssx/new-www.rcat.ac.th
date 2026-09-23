import { mapMediaAssetRowToPublicMediaAsset } from "../adapters/publicMediaAdapter";
import { authenticateAdminRequest, type AdminIdentity } from "../auth/adminAccess";
import { requireAdminCapability, type AdminCapability } from "../auth/adminCapabilities";
import { requireAdminStepUp } from "../auth/adminStepUp";
import { requireD1Database } from "../db/documentsRepository";
import { MEDIA_ASSET_ROW_COLUMNS, type ContentRow, type MediaAssetRow } from "../db/schema";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import {
  SecurityRateLimitExceeded,
  SecurityRateLimitUnavailable,
  enforceSecurityRateLimit
} from "../securityRateLimit";

const ADMIN_PREFIX = "/api/admin/";
const CONTENT_GOVERNANCE_COLUMNS = [
  "id",
  "slug",
  "type",
  "status",
  "owner",
  "title",
  "summary",
  "body_snapshot",
  "category",
  "tags_json",
  "seo_title",
  "seo_description",
  "canonical_url",
  "featured",
  "reading_minutes",
  "template",
  "body_doc_id",
  "body_doc_url",
  "featured_media_id",
  "media_ids_json",
  "view_count",
  "last_viewed_at",
  "updated_at",
  "publish_at",
  "unpublish_at",
  "created_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "revision"
] as const;
const CONTENT_BLOCKS_MARKER = "[[RCAT_BLOCKS_V1]]";
const MAX_REVISIONS = 50;
const MAX_AUDIT_PAGE_SIZE = 100;

type JsonRecord = Record<string, unknown>;
type GovernanceContentRow = ContentRow & { unpublish_at: string };
type GovernanceRoute =
  | { kind: "revisions"; contentId: string; capability: "content.read" }
  | { kind: "restore"; contentId: string; revision: number; capability: "content.update" }
  | { kind: "preview"; contentId: string; capability: "content.read" }
  | { kind: "expiry"; contentId: string; capability: "content.update" }
  | { kind: "audit"; capability: "audit.read" }
  | { kind: "media-usage"; mediaId: string; capability: "media.read" }
  | { kind: "media-accessibility"; mediaId: string; capability: "media.manage" }
  | { kind: "media-delete-protection"; mediaId: string; capability: "media.manage" };

interface ContentRevisionRow {
  id: string;
  content_id: string;
  revision: number;
  reason: string;
  actor: string;
  snapshot_json: string;
  created_at: string;
}

interface AdminAuditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  created_at: string;
  metadata_json: string;
}

interface MediaUsageItem {
  entityType: "content" | "document" | "event";
  id: string;
  title: string;
  detail: string;
}

function noStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function decodeSegment(value: string | undefined) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return "";
  }
}

function parseNonNegativeInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function matchGovernanceRoute(request: Request): GovernanceRoute | null {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(ADMIN_PREFIX)) return null;
  const segments = pathname.slice(ADMIN_PREFIX.length).split("/");

  if (segments[0] === "content" && segments[1]) {
    const contentId = decodeSegment(segments[1]);
    if (!contentId) return null;

    if (request.method === "GET" && segments.length === 3 && segments[2] === "revisions") {
      return { kind: "revisions", contentId, capability: "content.read" };
    }
    if (request.method === "GET" && segments.length === 3 && segments[2] === "preview") {
      return { kind: "preview", contentId, capability: "content.read" };
    }
    if (request.method === "PUT" && segments.length === 3 && segments[2] === "expiry") {
      return { kind: "expiry", contentId, capability: "content.update" };
    }
    if (
      request.method === "POST" &&
      segments.length === 5 &&
      segments[2] === "revisions" &&
      segments[4] === "restore"
    ) {
      const revision = parseNonNegativeInteger(segments[3]);
      return revision === null ? null : { kind: "restore", contentId, revision, capability: "content.update" };
    }
  }

  if (request.method === "GET" && segments.length === 1 && segments[0] === "audit-log") {
    return { kind: "audit", capability: "audit.read" };
  }

  if (segments[0] === "media" && segments[1]) {
    const mediaId = decodeSegment(segments[1]);
    if (!mediaId) return null;
    if (request.method === "GET" && segments.length === 3 && segments[2] === "usage") {
      return { kind: "media-usage", mediaId, capability: "media.read" };
    }
    if (request.method === "PATCH" && segments.length === 3 && segments[2] === "accessibility") {
      return { kind: "media-accessibility", mediaId, capability: "media.manage" };
    }
    if (request.method === "DELETE" && segments.length === 2) {
      return { kind: "media-delete-protection", mediaId, capability: "media.manage" };
    }
  }

  return null;
}

async function authenticateGovernanceRequest(
  request: Request,
  env: Env,
  route: GovernanceRoute
): Promise<AdminIdentity | Response> {
  const auth = await authenticateAdminRequest(request, env);
  if (auth.response || !auth.identity) return auth.response ?? jsonError("admin authentication failed", 403);
  const denied = requireAdminCapability(auth.identity, route.capability as AdminCapability, {
    resource: route.kind === "audit" ? "audit-log" : "cms-governance"
  });
  if (denied) return denied;

  try {
    await enforceSecurityRateLimit(request, env, "admin-api");
  } catch (error) {
    if (error instanceof SecurityRateLimitExceeded) {
      const response = jsonError("too many admin requests", 429, { resource: "cms-governance" });
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return noStore(response);
    }
    if (error instanceof SecurityRateLimitUnavailable) {
      return noStore(jsonError("admin security service is unavailable", 503, { resource: "cms-governance" }));
    }
    throw error;
  }

  const segments = new URL(request.url).pathname.slice(ADMIN_PREFIX.length).split("/");
  const stepUp = await requireAdminStepUp({ env, identity: auth.identity, method: request.method, segments });
  return stepUp ?? auth.identity;
}

function parseJsonRecord(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

function parseStringArray(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function mapContent(row: GovernanceContentRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    status: row.status,
    owner: row.owner ?? "",
    summary: row.summary,
    body: row.body_snapshot,
    category: row.category,
    tags: parseStringArray(row.tags_json),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    canonicalUrl: row.canonical_url,
    featured: row.featured === 1,
    readingMinutes: row.reading_minutes,
    template: row.template,
    bodyDocId: row.body_doc_id,
    bodyDocUrl: row.body_doc_url,
    featuredMediaId: row.featured_media_id,
    mediaIds: parseStringArray(row.media_ids_json),
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    updatedAt: row.updated_at,
    publishAt: row.publish_at,
    unpublishAt: row.unpublish_at,
    revision: Number(row.revision ?? 0)
  };
}

async function readContent(env: Env, contentId: string) {
  return requireD1Database(env)
    .prepare(
      `SELECT ${CONTENT_GOVERNANCE_COLUMNS.join(", ")}
       FROM contents
       WHERE id = ? AND COALESCE(deleted_at, '') = ''
       LIMIT 1`
    )
    .bind(contentId)
    .first<GovernanceContentRow>();
}

async function listRevisions(env: Env, contentId: string) {
  const result = await requireD1Database(env)
    .prepare(
      `SELECT id, content_id, revision, reason, actor, snapshot_json, created_at
       FROM content_revisions
       WHERE content_id = ?
       ORDER BY revision DESC, created_at DESC
       LIMIT ?`
    )
    .bind(contentId, MAX_REVISIONS)
    .all<ContentRevisionRow>();
  return result.results ?? [];
}

function normalizeRevisionSnapshot(row: ContentRevisionRow) {
  const snapshot = parseJsonRecord(row.snapshot_json);
  return {
    id: row.id,
    contentId: row.content_id,
    revision: Number(row.revision),
    reason: row.reason,
    actor: row.actor,
    createdAt: row.created_at,
    snapshot: snapshot
      ? {
          id: String(snapshot.id || row.content_id),
          slug: String(snapshot.slug || ""),
          type: String(snapshot.type || "page"),
          status: String(snapshot.status || "draft"),
          owner: String(snapshot.owner || ""),
          title: String(snapshot.title || ""),
          summary: String(snapshot.summary || ""),
          body: String(snapshot.body || ""),
          category: String(snapshot.category || ""),
          tags: parseStringArray(String(snapshot.tagsJson || "[]")),
          seoTitle: String(snapshot.seoTitle || ""),
          seoDescription: String(snapshot.seoDescription || ""),
          canonicalUrl: String(snapshot.canonicalUrl || ""),
          featured: Number(snapshot.featured || 0) === 1,
          readingMinutes: Math.max(0, Number(snapshot.readingMinutes || 0)),
          template: String(snapshot.template || "standard"),
          bodyDocId: String(snapshot.bodyDocId || ""),
          bodyDocUrl: String(snapshot.bodyDocUrl || ""),
          featuredMediaId: String(snapshot.featuredMediaId || ""),
          mediaIds: parseStringArray(String(snapshot.mediaIdsJson || "[]")),
          publishAt: String(snapshot.publishAt || ""),
          unpublishAt: String(snapshot.unpublishAt || ""),
          revision: Number(snapshot.revision || row.revision)
        }
      : null
  };
}

function expectedRevision(request: Request) {
  const raw = request.headers.get("X-RCAT-Expected-Revision")?.trim();
  if (!raw) return null;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : Number.NaN;
}

async function writeAudit(
  env: Env,
  input: { entityType: string; entityId: string; action: string; actor: string; metadata?: JsonRecord }
) {
  await requireD1Database(env)
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `audit-${crypto.randomUUID()}`,
      input.entityType,
      input.entityId,
      input.action,
      input.actor,
      new Date().toISOString(),
      JSON.stringify(input.metadata ?? {})
    )
    .run();
}

async function handleRestore(
  request: Request,
  env: Env,
  identity: AdminIdentity,
  contentId: string,
  revision: number
) {
  const current = await readContent(env, contentId);
  if (!current) return noStore(jsonError("not found", 404, { resource: "content" }));
  const requestedRevision = expectedRevision(request);
  if (Number.isNaN(requestedRevision)) {
    return noStore(jsonError("invalid expected revision", 400, { resource: "content" }));
  }
  if (requestedRevision !== null && Number(current.revision ?? 0) !== requestedRevision) {
    return noStore(jsonError("stale revision", 409, { resource: "content" }));
  }

  const target = await requireD1Database(env)
    .prepare(
      `SELECT id, content_id, revision, reason, actor, snapshot_json, created_at
       FROM content_revisions WHERE content_id = ? AND revision = ? LIMIT 1`
    )
    .bind(contentId, revision)
    .first<ContentRevisionRow>();
  const snapshot = target ? parseJsonRecord(target.snapshot_json) : null;
  if (!target || !snapshot) return noStore(jsonError("revision not found", 404, { resource: "content-revision" }));

  const slug = String(snapshot.slug || "").trim();
  if (!slug) return noStore(jsonError("revision has no valid slug", 409, { resource: "content-revision" }));
  const duplicate = await requireD1Database(env)
    .prepare("SELECT id FROM contents WHERE slug = ? AND id <> ? AND COALESCE(deleted_at, '') = '' LIMIT 1")
    .bind(slug, contentId)
    .first<{ id: string }>();
  if (duplicate) return noStore(jsonError("duplicate slug", 409, { resource: "content", field: "slug" }));

  const now = new Date().toISOString();
  const result = await requireD1Database(env)
    .prepare(
      `UPDATE contents SET
         slug = ?, type = ?, status = ?, owner = ?, title = ?, summary = ?, body_snapshot = ?, category = ?,
         tags_json = ?, seo_title = ?, seo_description = ?, canonical_url = ?, featured = ?, reading_minutes = ?,
         template = ?, body_doc_id = ?, body_doc_url = ?, featured_media_id = ?, media_ids_json = ?, publish_at = ?,
         unpublish_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ? AND COALESCE(deleted_at, '') = '' AND revision = ?`
    )
    .bind(
      slug,
      String(snapshot.type || current.type),
      String(snapshot.status || "draft"),
      String(snapshot.owner || ""),
      String(snapshot.title || ""),
      String(snapshot.summary || ""),
      String(snapshot.body || ""),
      String(snapshot.category || ""),
      String(snapshot.tagsJson || "[]"),
      String(snapshot.seoTitle || ""),
      String(snapshot.seoDescription || ""),
      String(snapshot.canonicalUrl || ""),
      Number(snapshot.featured || 0) === 1 ? 1 : 0,
      Math.max(0, Math.floor(Number(snapshot.readingMinutes || 0))),
      String(snapshot.template || "standard"),
      String(snapshot.bodyDocId || ""),
      String(snapshot.bodyDocUrl || ""),
      String(snapshot.featuredMediaId || ""),
      String(snapshot.mediaIdsJson || "[]"),
      String(snapshot.publishAt || ""),
      String(snapshot.unpublishAt || ""),
      now,
      identity.actor,
      contentId,
      Number(current.revision ?? 0)
    )
    .run();
  if (!result.meta.changes) return noStore(jsonError("stale revision", 409, { resource: "content" }));

  await writeAudit(env, {
    entityType: "content",
    entityId: contentId,
    action: "restore",
    actor: identity.actor,
    metadata: { restoredRevision: revision }
  });
  const restored = await readContent(env, contentId);
  return noStore(json({ item: restored ? mapContent(restored) : null, restoredRevision: revision }));
}

function normalizeExpiry(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

async function handleExpiry(request: Request, env: Env, identity: AdminIdentity, contentId: string) {
  const current = await readContent(env, contentId);
  if (!current) return noStore(jsonError("not found", 404, { resource: "content" }));
  const body = (await request.json().catch(() => null)) as JsonRecord | null;
  if (!body || Array.isArray(body)) return noStore(jsonError("invalid JSON body", 400, { resource: "content" }));
  const unpublishAt = normalizeExpiry(body.unpublishAt);
  if (unpublishAt === null) return noStore(jsonError("invalid unpublishAt", 400, { resource: "content" }));
  const publishAt = Date.parse(current.publish_at || "");
  if (unpublishAt && Number.isFinite(publishAt) && Date.parse(unpublishAt) <= publishAt) {
    return noStore(jsonError("unpublishAt must be after publishAt", 400, { resource: "content" }));
  }
  const requestedRevision = expectedRevision(request);
  if (Number.isNaN(requestedRevision)) return noStore(jsonError("invalid expected revision", 400));
  if (requestedRevision !== null && requestedRevision !== Number(current.revision ?? 0)) {
    return noStore(jsonError("stale revision", 409, { resource: "content" }));
  }

  const now = new Date().toISOString();
  const result = await requireD1Database(env)
    .prepare(
      `UPDATE contents SET unpublish_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ? AND COALESCE(deleted_at, '') = '' AND revision = ?`
    )
    .bind(unpublishAt, now, identity.actor, contentId, Number(current.revision ?? 0))
    .run();
  if (!result.meta.changes) return noStore(jsonError("stale revision", 409, { resource: "content" }));
  await writeAudit(env, {
    entityType: "content",
    entityId: contentId,
    action: unpublishAt ? "expiry-set" : "expiry-clear",
    actor: identity.actor,
    metadata: unpublishAt ? { unpublishAt } : {}
  });
  const updated = await readContent(env, contentId);
  return noStore(json({ item: updated ? mapContent(updated) : null }));
}

function collectPreviewMediaIds(row: GovernanceContentRow) {
  return [...new Set([row.featured_media_id, ...parseStringArray(row.media_ids_json)].filter(Boolean))];
}

async function handlePreview(env: Env, contentId: string) {
  const row = await readContent(env, contentId);
  if (!row) return noStore(jsonError("not found", 404, { resource: "content" }));
  const ids = collectPreviewMediaIds(row);
  let media: ReturnType<typeof mapMediaAssetRowToPublicMediaAsset>[] = [];
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(", ");
    const result = await requireD1Database(env)
      .prepare(`SELECT ${MEDIA_ASSET_ROW_COLUMNS.join(", ")} FROM media_assets WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all<MediaAssetRow>();
    media = (result.results ?? []).map(mapMediaAssetRowToPublicMediaAsset);
  }
  return noStore(json({ item: mapContent(row), media, generatedAt: new Date().toISOString() }));
}

function containsMediaReference(value: unknown, mediaId: string): boolean {
  if (value === mediaId) return true;
  if (Array.isArray(value)) return value.some((item) => containsMediaReference(item, mediaId));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as JsonRecord).some(([key, item]) => {
    if ((key === "mediaId" || key === "featuredMediaId") && item === mediaId) return true;
    if (key === "mediaIds" && Array.isArray(item) && item.some((id) => id === mediaId)) return true;
    return containsMediaReference(item, mediaId);
  });
}

function bodyReferencesMedia(body: string, mediaId: string) {
  const trimmed = body.trim();
  if (!trimmed.startsWith(CONTENT_BLOCKS_MARKER)) return false;
  const parsed = parseJsonRecord(trimmed.slice(CONTENT_BLOCKS_MARKER.length));
  return parsed ? containsMediaReference(parsed, mediaId) : false;
}

async function findMediaUsage(env: Env, mediaId: string): Promise<MediaUsageItem[]> {
  const db = requireD1Database(env);
  const contentResult = await db
    .prepare(
      `SELECT id, title, slug, type, featured_media_id, media_ids_json, body_snapshot
       FROM contents
       WHERE COALESCE(deleted_at, '') = ''
         AND (featured_media_id = ? OR media_ids_json LIKE ? OR body_snapshot LIKE ?)`
    )
    .bind(mediaId, `%${mediaId}%`, `%${mediaId}%`)
    .all<{
      id: string;
      title: string;
      slug: string;
      type: string;
      featured_media_id: string;
      media_ids_json: string;
      body_snapshot: string;
    }>();
  const documentResult = await db
    .prepare("SELECT id, title FROM documents WHERE COALESCE(deleted_at, '') = '' AND media_id = ?")
    .bind(mediaId)
    .all<{ id: string; title: string }>();
  const eventResult = await db
    .prepare("SELECT id, title, media_ids_json FROM events WHERE media_ids_json LIKE ?")
    .bind(`%${mediaId}%`)
    .all<{ id: string; title: string; media_ids_json: string }>();

  const items: MediaUsageItem[] = [];
  for (const row of contentResult.results ?? []) {
    const direct = row.featured_media_id === mediaId || parseStringArray(row.media_ids_json).includes(mediaId);
    if (direct || bodyReferencesMedia(row.body_snapshot, mediaId)) {
      items.push({ entityType: "content", id: row.id, title: row.title, detail: row.type });
    }
  }
  for (const row of documentResult.results ?? []) {
    items.push({ entityType: "document", id: row.id, title: row.title, detail: "document" });
  }
  for (const row of eventResult.results ?? []) {
    if (parseStringArray(row.media_ids_json).includes(mediaId)) {
      items.push({ entityType: "event", id: row.id, title: row.title, detail: "event" });
    }
  }
  return items;
}

async function handleMediaUsage(env: Env, mediaId: string) {
  const media = await requireD1Database(env)
    .prepare("SELECT id, name, alt_text FROM media_assets WHERE id = ? LIMIT 1")
    .bind(mediaId)
    .first<{ id: string; name: string; alt_text: string }>();
  if (!media) return noStore(jsonError("not found", 404, { resource: "media" }));
  const items = await findMediaUsage(env, mediaId);
  return noStore(json({ mediaId, name: media.name, altText: media.alt_text || "", count: items.length, items }));
}

async function handleMediaAccessibility(request: Request, env: Env, identity: AdminIdentity, mediaId: string) {
  const body = (await request.json().catch(() => null)) as JsonRecord | null;
  if (!body || typeof body.altText !== "string") {
    return noStore(jsonError("altText is required", 400, { resource: "media" }));
  }
  const altText = body.altText.trim().slice(0, 500);
  const now = new Date().toISOString();
  const result = await requireD1Database(env)
    .prepare("UPDATE media_assets SET alt_text = ?, updated_at = ? WHERE id = ?")
    .bind(altText, now, mediaId)
    .run();
  if (!result.meta.changes) return noStore(jsonError("not found", 404, { resource: "media" }));
  await writeAudit(env, {
    entityType: "media",
    entityId: mediaId,
    action: "accessibility-update",
    actor: identity.actor,
    metadata: { hasAltText: Boolean(altText) }
  });
  return noStore(json({ id: mediaId, altText, updatedAt: now }));
}

async function handleAudit(request: Request, env: Env) {
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(MAX_AUDIT_PAGE_SIZE, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "25", 10) || 25));
  const entityType = (url.searchParams.get("entityType") || "").trim().slice(0, 80);
  const action = (url.searchParams.get("action") || "").trim().slice(0, 80);
  const actor = (url.searchParams.get("actor") || "").trim().slice(0, 160);
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (entityType) {
    clauses.push("entity_type = ?");
    bindings.push(entityType);
  }
  if (action) {
    clauses.push("action = ?");
    bindings.push(action);
  }
  if (actor) {
    clauses.push("actor LIKE ?");
    bindings.push(`%${actor}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const db = requireD1Database(env);
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM admin_audit_log ${where}`)
    .bind(...bindings)
    .first<{ total: number | string }>();
  const totalItems = Math.max(0, Number(countRow?.total || 0));
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const result = await db
    .prepare(
      `SELECT id, entity_type, entity_id, action, actor, created_at, metadata_json
       FROM admin_audit_log ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...bindings, pageSize, (normalizedPage - 1) * pageSize)
    .all<AdminAuditRow>();
  return noStore(
    json({
      items: (result.results ?? []).map((row) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        actor: row.actor,
        createdAt: row.created_at,
        metadata: parseJsonRecord(row.metadata_json) ?? {}
      })),
      pagination: { page: normalizedPage, pageSize, totalItems, totalPages },
      generatedAt: new Date().toISOString()
    })
  );
}

export async function handleAdminContentGovernance(request: Request, env: Env): Promise<Response | null> {
  const route = matchGovernanceRoute(request);
  if (!route) return null;
  if (!env.DB) return noStore(jsonError("database binding is not configured", 503, { resource: "cms-governance" }));

  const authenticated = await authenticateGovernanceRequest(request, env, route);
  if (authenticated instanceof Response) return noStore(authenticated);

  if (route.kind === "revisions") {
    const current = await readContent(env, route.contentId);
    if (!current) return noStore(jsonError("not found", 404, { resource: "content" }));
    const revisions = await listRevisions(env, route.contentId);
    return noStore(
      json({
        contentId: route.contentId,
        currentRevision: Number(current.revision ?? 0),
        items: revisions.map(normalizeRevisionSnapshot)
      })
    );
  }
  if (route.kind === "restore") return handleRestore(request, env, authenticated, route.contentId, route.revision);
  if (route.kind === "preview") return handlePreview(env, route.contentId);
  if (route.kind === "expiry") return handleExpiry(request, env, authenticated, route.contentId);
  if (route.kind === "audit") return handleAudit(request, env);
  if (route.kind === "media-usage") return handleMediaUsage(env, route.mediaId);
  if (route.kind === "media-accessibility") return handleMediaAccessibility(request, env, authenticated, route.mediaId);
  if (route.kind === "media-delete-protection") {
    const usage = await findMediaUsage(env, route.mediaId);
    return usage.length
      ? noStore(
          jsonError("media is still in use", 409, {
            resource: "media",
            usageCount: usage.length,
            usage: usage.slice(0, 20)
          })
        )
      : null;
  }
  return null;
}
