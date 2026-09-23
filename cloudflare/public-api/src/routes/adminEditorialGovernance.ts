import { authenticateAdminRequest, type AdminIdentity } from "../auth/adminAccess";
import { requireAdminCapability, type AdminCapability } from "../auth/adminCapabilities";
import { requireAdminStepUp } from "../auth/adminStepUp";
import { requireD1Database } from "../db/documentsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import {
  enforceSecurityRateLimit,
  SecurityRateLimitExceeded,
  SecurityRateLimitUnavailable
} from "../securityRateLimit";

const ADMIN_PREFIX = "/api/admin/";
const MAX_TRASH_ITEMS = 100;
const DELETED_CONTENT_SLUG_PREFIX = "__deleted__:";
const WORKFLOW_STATUSES = new Set(["draft", "review"] as const);

type EditorialWorkflowStatus = "draft" | "review";
type JsonRecord = Record<string, unknown>;
type EditorialRoute =
  | { kind: "trash"; capability: "content.read" }
  | { kind: "workflow"; contentId: string; capability: "content.update" }
  | { kind: "trash-restore"; contentId: string; capability: "content.update" };

interface EditorialContentRow {
  id: string;
  slug: string;
  type: string;
  status: string;
  owner: string;
  title: string;
  summary: string;
  body_snapshot: string;
  updated_at: string;
  publish_at: string;
  deleted_at: string;
  revision: number;
}

interface ContentRevisionRow {
  snapshot_json: string;
  revision: number;
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

function matchEditorialRoute(request: Request): EditorialRoute | null {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(ADMIN_PREFIX)) return null;
  const segments = pathname.slice(ADMIN_PREFIX.length).split("/");

  if (request.method === "GET" && segments.length === 2 && segments[0] === "content" && segments[1] === "trash") {
    return { kind: "trash", capability: "content.read" };
  }

  if (segments[0] !== "content" || segments.length !== 3) return null;
  const contentId = decodeSegment(segments[1]);
  if (!contentId) return null;

  if (request.method === "PUT" && segments[2] === "workflow") {
    return { kind: "workflow", contentId, capability: "content.update" };
  }
  if (request.method === "POST" && segments[2] === "restore") {
    return { kind: "trash-restore", contentId, capability: "content.update" };
  }
  return null;
}

async function authenticateEditorialRequest(request: Request, env: Env, route: EditorialRoute) {
  const auth = await authenticateAdminRequest(request, env);
  if (auth.response || !auth.identity) return auth.response ?? jsonError("admin authentication failed", 403);

  const denied = requireAdminCapability(auth.identity, route.capability as AdminCapability, {
    resource: route.kind === "trash" ? "content-trash" : "content-editorial-workflow"
  });
  if (denied) return denied;

  try {
    await enforceSecurityRateLimit(request, env, "admin-api");
  } catch (error) {
    if (error instanceof SecurityRateLimitExceeded) {
      const response = jsonError("too many admin requests", 429, { resource: "content-editorial-workflow" });
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return noStore(response);
    }
    if (error instanceof SecurityRateLimitUnavailable) {
      return noStore(jsonError("admin security service is unavailable", 503, { resource: "content-editorial-workflow" }));
    }
    throw error;
  }

  const segments = new URL(request.url).pathname.slice(ADMIN_PREFIX.length).split("/");
  const stepUp = await requireAdminStepUp({ env, identity: auth.identity, method: request.method, segments });
  return stepUp ?? auth.identity;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJsonRecord(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function expectedRevision(request: Request) {
  const raw = request.headers.get("X-RCAT-Expected-Revision")?.trim();
  if (!raw) return null;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : Number.NaN;
}

function mapEditorialContent(row: EditorialContentRow) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    status: row.status,
    owner: row.owner || "",
    title: row.title,
    summary: row.summary,
    updatedAt: row.updated_at,
    publishAt: row.publish_at,
    deletedAt: row.deleted_at || "",
    revision: Number(row.revision ?? 0)
  };
}

async function readContentAny(env: Env, contentId: string) {
  return requireD1Database(env)
    .prepare(
      `SELECT id, slug, type, status, owner, title, summary, body_snapshot, updated_at, publish_at, deleted_at, revision
       FROM contents
       WHERE id = ?
       LIMIT 1`
    )
    .bind(contentId)
    .first<EditorialContentRow>();
}

async function writeAudit(
  env: Env,
  input: { entityId: string; action: string; actor: string; metadata?: JsonRecord }
) {
  await requireD1Database(env)
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       VALUES (?, 'content', ?, ?, ?, ?, ?)`
    )
    .bind(
      `audit-${crypto.randomUUID()}`,
      input.entityId,
      input.action,
      input.actor,
      new Date().toISOString(),
      JSON.stringify(input.metadata ?? {})
    )
    .run();
}

export function validateEditorialTransition(currentStatus: string, targetStatus: unknown) {
  if (typeof targetStatus !== "string" || !WORKFLOW_STATUSES.has(targetStatus as EditorialWorkflowStatus)) {
    return { ok: false as const, error: "invalid editorial workflow status", status: 400 };
  }
  if (!WORKFLOW_STATUSES.has(currentStatus as EditorialWorkflowStatus)) {
    return {
      ok: false as const,
      error: "published or scheduled content must be unpublished before editorial workflow changes",
      status: 409
    };
  }
  return { ok: true as const, status: targetStatus as EditorialWorkflowStatus };
}

function reviewReadinessError(row: EditorialContentRow) {
  if (!row.title.trim()) return "title is required before review";
  if (!row.slug.trim() || row.slug.startsWith(DELETED_CONTENT_SLUG_PREFIX)) return "valid slug is required before review";
  if (!row.summary.trim()) return "summary is required before review";
  if (!row.body_snapshot.trim()) return "content body is required before review";
  return "";
}

async function handleWorkflow(
  request: Request,
  env: Env,
  identity: AdminIdentity,
  contentId: string
) {
  const current = await readContentAny(env, contentId);
  if (!current || current.deleted_at) return noStore(jsonError("not found", 404, { resource: "content" }));

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body)) return noStore(jsonError("invalid JSON body", 400, { resource: "content" }));

  const transition = validateEditorialTransition(current.status, body.status);
  if (!transition.ok) return noStore(jsonError(transition.error, transition.status, { resource: "content" }));
  if (transition.status === current.status) return noStore(json({ item: mapEditorialContent(current) }));

  if (transition.status === "review") {
    const readinessError = reviewReadinessError(current);
    if (readinessError) return noStore(jsonError(readinessError, 409, { resource: "content" }));
  }

  const requestedRevision = expectedRevision(request);
  if (Number.isNaN(requestedRevision)) {
    return noStore(jsonError("invalid expected revision", 400, { resource: "content" }));
  }
  if (requestedRevision !== null && requestedRevision !== Number(current.revision ?? 0)) {
    return noStore(jsonError("stale revision", 409, { resource: "content" }));
  }

  const now = new Date().toISOString();
  const result = await requireD1Database(env)
    .prepare(
      `UPDATE contents
       SET status = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
         AND revision = ?`
    )
    .bind(transition.status, now, identity.actor, contentId, Number(current.revision ?? 0))
    .run();
  if (!result.meta.changes) return noStore(jsonError("stale revision", 409, { resource: "content" }));

  await writeAudit(env, {
    entityId: contentId,
    action: transition.status === "review" ? "review-submit" : "review-return",
    actor: identity.actor,
    metadata: { from: current.status, to: transition.status }
  });

  const updated = await readContentAny(env, contentId);
  return noStore(json({ item: updated ? mapEditorialContent(updated) : null }));
}

async function handleTrash(env: Env) {
  const result = await requireD1Database(env)
    .prepare(
      `SELECT id, slug, type, status, owner, title, summary, body_snapshot, updated_at, publish_at, deleted_at, revision
       FROM contents
       WHERE COALESCE(deleted_at, '') <> ''
       ORDER BY deleted_at DESC, updated_at DESC
       LIMIT ?`
    )
    .bind(MAX_TRASH_ITEMS)
    .all<EditorialContentRow>();

  return noStore(
    json({
      items: (result.results ?? []).map(mapEditorialContent),
      generatedAt: new Date().toISOString(),
      maximumItems: MAX_TRASH_ITEMS
    })
  );
}

export function readOriginalSlugFromDeleteSnapshot(snapshotJson: string) {
  const snapshot = parseJsonRecord(snapshotJson);
  const slug = typeof snapshot?.slug === "string" ? snapshot.slug.trim() : "";
  return slug && !slug.startsWith(DELETED_CONTENT_SLUG_PREFIX) ? slug : "";
}

async function handleTrashRestore(
  request: Request,
  env: Env,
  identity: AdminIdentity,
  contentId: string
) {
  const current = await readContentAny(env, contentId);
  if (!current || !current.deleted_at) return noStore(jsonError("not found", 404, { resource: "content-trash" }));

  const requestedRevision = expectedRevision(request);
  if (Number.isNaN(requestedRevision)) {
    return noStore(jsonError("invalid expected revision", 400, { resource: "content-trash" }));
  }
  if (requestedRevision !== null && requestedRevision !== Number(current.revision ?? 0)) {
    return noStore(jsonError("stale revision", 409, { resource: "content-trash" }));
  }

  const revision = await requireD1Database(env)
    .prepare(
      `SELECT snapshot_json, revision
       FROM content_revisions
       WHERE content_id = ? AND reason = 'delete'
       ORDER BY revision DESC, created_at DESC
       LIMIT 1`
    )
    .bind(contentId)
    .first<ContentRevisionRow>();
  const originalSlug = revision ? readOriginalSlugFromDeleteSnapshot(revision.snapshot_json) : "";
  if (!originalSlug) {
    return noStore(
      jsonError("original slug is unavailable for this deleted item", 409, {
        resource: "content-trash",
        diagnostic: "missing-delete-snapshot"
      })
    );
  }

  const duplicate = await requireD1Database(env)
    .prepare("SELECT id FROM contents WHERE slug = ? AND id <> ? AND COALESCE(deleted_at, '') = '' LIMIT 1")
    .bind(originalSlug, contentId)
    .first<{ id: string }>();
  if (duplicate) {
    return noStore(jsonError("duplicate slug", 409, { resource: "content-trash", field: "slug" }));
  }

  const now = new Date().toISOString();
  const result = await requireD1Database(env)
    .prepare(
      `UPDATE contents
       SET slug = ?, status = 'draft', deleted_at = '', updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') <> ''
         AND revision = ?`
    )
    .bind(originalSlug, now, identity.actor, contentId, Number(current.revision ?? 0))
    .run();
  if (!result.meta.changes) return noStore(jsonError("stale revision", 409, { resource: "content-trash" }));

  await writeAudit(env, {
    entityId: contentId,
    action: "trash-restore",
    actor: identity.actor,
    metadata: { restoredSlug: originalSlug, restoredAs: "draft", previousStatus: current.status }
  });

  const restored = await readContentAny(env, contentId);
  return noStore(json({ item: restored ? mapEditorialContent(restored) : null }));
}

export async function handleAdminEditorialGovernance(request: Request, env: Env): Promise<Response | null> {
  const route = matchEditorialRoute(request);
  if (!route) return null;
  if (!env.DB) {
    return noStore(jsonError("database binding is not configured", 503, { resource: "content-editorial-workflow" }));
  }

  const authenticated = await authenticateEditorialRequest(request, env, route);
  if (authenticated instanceof Response) return noStore(authenticated);

  if (route.kind === "trash") return handleTrash(env);
  if (route.kind === "workflow") return handleWorkflow(request, env, authenticated, route.contentId);
  return handleTrashRestore(request, env, authenticated, route.contentId);
}
