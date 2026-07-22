import { createPublicContentListSnapshot } from "../adapters/publicContentAdapter";
import { createPublicDocumentListSnapshot } from "../adapters/publicDocumentsAdapter";
import { createEmptyPublicMetadata } from "../adapters/publicMetadataAdapter";
import { createPublicVisitorStatsSnapshot } from "../adapters/publicVisitorStatsAdapter";
import { authenticateAdminRequest, hasProductionContext, type AdminIdentity } from "../auth/adminAccess";
import {
  getCapabilitiesForRole,
  hasAdminCapability,
  requireAdminCapability,
  requireAnyAdminCapability
} from "../auth/adminCapabilities";
import {
  isSupportedAdminRoutePath,
  resolveAdminRoutePolicy,
  type AdminUserUpdateAuthorization
} from "../auth/adminRoutePolicy";
import {
  generateInvitationToken,
  generatePasswordResetToken,
  hashInvitationToken,
  hashPasswordResetToken
} from "../auth/cmsLifecycleToken";
import { listPublishedContentRows } from "../db/contentRepository";
import { requireD1Database } from "../db/documentsRepository";
import {
  AdminUserLifecycleConflict,
  CMS_INVITATION_LIFETIME_SECONDS,
  CMS_PASSWORD_RESET_LIFETIME_SECONDS,
  createAdminUserLifecycleRepository,
  type SafeAdminUserLifecycle
} from "../db/adminUserLifecycleRepository";
import { listPublishedDocumentRows } from "../db/documentsRepository";
import {
  CONTENT_ADMIN_ROW_COLUMNS,
  DOCUMENT_ADMIN_ROW_COLUMNS,
  PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS,
  VISITOR_DAILY_STATS_ADMIN_ROW_COLUMNS,
  type AdminPasswordResetTokenRow,
  type AdminUserInvitationRow,
  type AdminUserRow,
  type ContentRow,
  type DocumentRow,
  type PublicHomeSectionRow,
  type VisitorDailyStatsRow
} from "../db/schema";
import type { Env } from "../env";
import { json, jsonError, methodNotAllowed } from "../responses";
import { handleAdminBackup } from "./adminBackup";
import { handleAdminAuth } from "./adminAuth";
import { handleAdminPaginatedReads } from "./adminPagination";
import { handleAdminStructuredParity, readAdminStructuredSnapshot } from "./adminStructuredParity";

const ADMIN_PREFIX = "/api/admin/";
const ADMIN_ALLOW = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const CONTENT_TYPES = new Set(["page", "news", "program", "announcement", "blog"]);
const CONTENT_STATUSES = new Set(["draft", "review", "scheduled", "published"]);
const DELETED_CONTENT_SLUG_PREFIX = "__deleted__:";
const DOCUMENT_STATUSES = new Set(["draft", "published"]);
const ADMIN_USER_ROLES = new Set(["admin", "editor", "viewer"]);
const ADMIN_USER_STATUSES = new Set(["active", "disabled"]);
const SELF_USER_UPDATE_FIELDS = new Set(["name", "revision"]);
const ADMIN_USER_UPDATE_FIELDS = new Set(["email", "name", "role", "status", "username", "revision"]);
const PREVIEW_WRITE_SCHEMA = {
  contents: ["slug", "deleted_at", "updated_by", "revision"],
  homepage_settings: ["id", "settings_json", "updated_at", "created_at", "updated_by", "revision"],
  site_settings: ["id", "settings_json", "updated_at", "created_at", "updated_by", "revision"],
  display_settings: ["id", "settings_json", "updated_at", "created_at", "updated_by", "revision"],
  carousel_slides: ["id", "title", "image_url", "created_at", "updated_by", "revision"],
  external_services: ["id", "title", "href", "created_at", "updated_by", "revision"],
  events: ["id", "title", "date", "media_ids_json", "created_at", "updated_by", "revision"],
  media_assets: ["id", "drive_url", "preview_url", "embed_url", "thumbnail_url"],
  app_admin_users: ["id", "email", "name", "role", "status", "created_at", "updated_by", "revision"]
} as const;

type JsonRecord = Record<string, unknown>;
type ContentPublishRoute = "content.publish" | "content.unpublish";
type PreviewWriteTable = keyof typeof PREVIEW_WRITE_SCHEMA;

interface AdminRouteErrorContext {
  contentId?: string;
  expectedRevisionPresent?: boolean;
  operation: string;
  route?: ContentPublishRoute;
  routeGroup: string;
}

class AdminHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: JsonRecord = {}
  ) {
    super(message);
    this.name = "AdminHttpError";
    Object.setPrototypeOf(this, AdminHttpError.prototype);
  }
}

class AdminRouteContextError extends Error {
  constructor(
    readonly context: AdminRouteErrorContext,
    readonly cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "AdminRouteContextError";
    Object.setPrototypeOf(this, AdminRouteContextError.prototype);
  }
}

function isAdminHttpError(error: unknown): error is AdminHttpError {
  return (
    isRecord(error) &&
    typeof error.message === "string" &&
    typeof error.status === "number" &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getErrorCause(error: unknown) {
  return error instanceof AdminRouteContextError ? error.cause : error;
}

function getErrorContext(error: unknown) {
  return error instanceof AdminRouteContextError ? error.context : null;
}

function getErrorName(error: unknown) {
  return error instanceof Error && error.name ? error.name : typeof error;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

function sanitizeDiagnosticText(value: string) {
  return value
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE)\b/gi, "[database-operation]")
    .replace(/\bstack\b/gi, "[trace]")
    .replace(/\bD1(?:_ERROR)?\b/gi, "database")
    .replace(
      /\b(?:token|secret|cookie|authorization|cf-access-jwt-assertion|headers?|bindings?|request body|fileBase64|appsScriptBridgeToken|mediaBridgeToken|password)\b[^\s,;)]*/gi,
      "[redacted]"
    )
    .slice(0, 300);
}

function shouldIncludePreviewDiagnostics(env: Env) {
  return env.ENVIRONMENT === "preview" && !hasProductionContext(env);
}

async function withAdminRouteContext<T>(context: AdminRouteErrorContext, callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    throw new AdminRouteContextError(context, error);
  }
}

function getAdminRouteContext(request: Request, segments: string[]): AdminRouteErrorContext {
  const routeGroup = segments[0] || "unknown";
  const action = segments[2];
  let operation = request.method.toLowerCase();

  if (routeGroup === "content") {
    operation =
      action === "publish" || action === "unpublish"
        ? action
        : request.method === "POST"
          ? "create"
          : request.method === "PATCH"
            ? "update"
            : request.method.toLowerCase();
  } else if (routeGroup === "settings") {
    operation = `${segments[1] || "unknown"}.save`;
  } else if (["carousel", "external-services", "events"].includes(routeGroup)) {
    operation =
      request.method === "POST" ? "create" : request.method === "PATCH" ? "update" : request.method.toLowerCase();
  }

  return { routeGroup, operation };
}

function getPreviewWriteTable(segments: string[]): PreviewWriteTable | null {
  if (segments[0] === "content") {
    return "contents";
  }

  if (segments[0] === "settings") {
    const tableBySetting: Record<string, PreviewWriteTable> = {
      homepage: "homepage_settings",
      site: "site_settings",
      display: "display_settings"
    };
    return tableBySetting[segments[1] || ""] ?? null;
  }

  const tableByRoute: Record<string, PreviewWriteTable> = {
    carousel: "carousel_slides",
    "external-services": "external_services",
    events: "events",
    media: "media_assets",
    users: "app_admin_users"
  };
  return tableByRoute[segments[0] || ""] ?? null;
}

async function getPreviewSchemaMismatch(env: Env, request: Request, segments: string[]) {
  if (request.method === "GET" || !shouldIncludePreviewDiagnostics(env)) {
    return null;
  }

  const table = getPreviewWriteTable(segments);

  if (!table) {
    return null;
  }

  const db = requireD1Database(env);
  const missingColumns: string[] = [];

  for (const column of PREVIEW_WRITE_SCHEMA[table]) {
    try {
      await db.prepare(`SELECT ${column} FROM ${table} LIMIT 0`).all();
    } catch {
      missingColumns.push(column);
    }
  }

  return missingColumns.length ? { table, missingColumns } : null;
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown, fallback = "") {
  const trimmed = trimString(value);

  return trimmed || fallback;
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 1 || value === "true" || value === "TRUE";
}

function normalizeInteger(value: unknown, fallback = 0) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}

function parseJsonArray(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return "[]";
  }

  return JSON.stringify(value.map((item) => String(item || "").trim()).filter(Boolean));
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function parseJsonBody(request: Request) {
  try {
    const body = await request.json();

    if (!isRecord(body)) {
      throw new AdminHttpError("request body must be a JSON object", 400);
    }

    return body;
  } catch (error) {
    if (error instanceof AdminHttpError) {
      throw error;
    }

    throw new AdminHttpError("malformed JSON request body", 400);
  }
}

function requireValue(body: JsonRecord, key: string) {
  const value = trimString(body[key]);

  if (!value) {
    throw new AdminHttpError(`missing required field: ${key}`, 400);
  }

  return value;
}

function assertAllowedValue(value: string, allowed: Set<string>, label: string) {
  if (!allowed.has(value)) {
    throw new AdminHttpError(`invalid ${label}`, 400);
  }

  return value;
}

function parseRevisionValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const revision = Number(value);

  if (!Number.isInteger(revision) || revision < 0) {
    throw new AdminHttpError("expectedRevision must be a non-negative integer", 400);
  }

  return revision;
}

function getExpectedRevisionFromRequest(request: Request, body: JsonRecord = {}) {
  const header = request.headers.get("X-RCAT-Expected-Revision")?.trim();

  return parseRevisionValue(header || body.expectedRevision);
}

function getConfiguredOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function requireAllowedAdminOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return null;
  }

  if (!getConfiguredOrigins(env.ADMIN_WRITE_ALLOWED_ORIGINS).includes(origin)) {
    return jsonError("admin origin is not allowed", 403, {
      resource: "admin-structured-data"
    });
  }

  return null;
}

function mapContentRowToAdminItem(row: ContentRow) {
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
    tags: parseJsonArray(row.tags_json).map(String),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    canonicalUrl: row.canonical_url,
    featured: row.featured === 1,
    readingMinutes: row.reading_minutes,
    template: row.template,
    bodyDocId: row.body_doc_id,
    bodyDocUrl: row.body_doc_url,
    featuredMediaId: row.featured_media_id,
    mediaIds: parseJsonArray(row.media_ids_json).map(String),
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    updatedAt: row.updated_at,
    publishAt: row.publish_at,
    revision: Number(row.revision ?? 0)
  };
}

function mapDocumentRowToAdminItem(row: DocumentRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    fileUrl: row.file_url,
    fileName: row.file_name,
    mediaId: row.media_id,
    publishedAt: row.published_at,
    status: row.status,
    order: row.sort_order,
    pinned: row.pinned === 1,
    updatedAt: row.updated_at,
    revision: Number(row.revision ?? 0)
  };
}

function mapHomeSectionRowToAdminItem(row: PublicHomeSectionRow) {
  return {
    id: row.id,
    key: row.section_key,
    title: row.title,
    summary: row.summary,
    href: row.href,
    order: row.sort_order,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at,
    revision: Number(row.revision ?? 0)
  };
}

function mapVisitorDailyStatsRowToAdminItem(row: VisitorDailyStatsRow) {
  return {
    day: row.day,
    total: row.total_views,
    uniqueVisitors: row.unique_visitors,
    onlineUsers: row.online_users,
    updatedAt: row.updated_at,
    revision: Number(row.revision ?? 0)
  };
}

async function getFirst<T>(env: Env, query: string, ...bindings: unknown[]) {
  const db = requireD1Database(env);

  return db
    .prepare(query)
    .bind(...bindings)
    .first<T>();
}

async function getAll<T>(env: Env, query: string, ...bindings: unknown[]) {
  const db = requireD1Database(env);
  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<T>();

  return result.results ?? [];
}

async function run(env: Env, query: string, ...bindings: unknown[]) {
  const db = requireD1Database(env);

  return db
    .prepare(query)
    .bind(...bindings)
    .run();
}

function getChangedRows(result: D1Result<unknown>) {
  const meta = result.meta as { changes?: number; rows_written?: number } | undefined;

  return Number(meta?.changes ?? meta?.rows_written ?? 0);
}

function assertMutationChanged(result: D1Result<unknown>) {
  if (getChangedRows(result) === 0) {
    throw new AdminHttpError("stale revision", 409);
  }
}

function normalizeContentPublishAt(action: string, value: unknown, now: string) {
  const currentPublishAt = trimString(value);

  if (action === "publish") {
    return currentPublishAt || now;
  }

  return currentPublishAt;
}

async function assertContentPublishChanged(
  env: Env,
  result: D1Result<unknown>,
  id: string,
  expectedRevision: number | null
) {
  if (getChangedRows(result) > 0) {
    return;
  }

  const current = await getContentByIdAny(env, id);

  if (!current || trimString(current.deleted_at)) {
    throw new AdminHttpError("not found", 404);
  }

  if (expectedRevision !== null && Number(current.revision ?? 0) !== expectedRevision) {
    throw new AdminHttpError("stale revision", 409);
  }

  throw new AdminHttpError("content publish did not update", 409);
}

function createContentRow(body: JsonRecord, existing: ContentRow | null, actor: string, now: string): ContentRow {
  const status = assertAllowedValue(
    optionalString(body.status, existing?.status ?? "draft"),
    CONTENT_STATUSES,
    "content status"
  );
  const type = assertAllowedValue(optionalString(body.type, existing?.type ?? ""), CONTENT_TYPES, "content type");
  const id = optionalString(body.id, existing?.id ?? makeId("content"));

  return {
    id,
    slug: requireValue(body, "slug"),
    type,
    status,
    owner: requireValue(body, "owner"),
    title: requireValue(body, "title"),
    summary: optionalString(body.summary, existing?.summary ?? ""),
    body_snapshot: optionalString(body.body, existing?.body_snapshot ?? ""),
    category: optionalString(body.category, existing?.category ?? ""),
    tags_json: serializeStringArray(body.tags ?? parseJsonArray(existing?.tags_json)),
    seo_title: optionalString(body.seoTitle, existing?.seo_title ?? ""),
    seo_description: optionalString(body.seoDescription, existing?.seo_description ?? ""),
    canonical_url: optionalString(body.canonicalUrl, existing?.canonical_url ?? ""),
    featured: normalizeBoolean(body.featured ?? existing?.featured) ? 1 : 0,
    reading_minutes: normalizeInteger(body.readingMinutes, existing?.reading_minutes ?? 0),
    template: optionalString(body.template, existing?.template ?? "standard"),
    body_doc_id: optionalString(body.bodyDocId, existing?.body_doc_id ?? ""),
    body_doc_url: optionalString(body.bodyDocUrl, existing?.body_doc_url ?? ""),
    featured_media_id: optionalString(body.featuredMediaId, existing?.featured_media_id ?? ""),
    media_ids_json: serializeStringArray(body.mediaIds ?? parseJsonArray(existing?.media_ids_json)),
    view_count: normalizeInteger(existing?.view_count, 0),
    last_viewed_at: optionalString(existing?.last_viewed_at, ""),
    updated_at: now,
    publish_at: optionalString(body.publishAt, existing?.publish_at ?? now),
    created_at: optionalString(existing?.created_at, now),
    deleted_at: "",
    created_by: optionalString(existing?.created_by, actor),
    updated_by: actor,
    revision: existing ? Number(existing.revision ?? 0) + 1 : 0
  };
}

function createDocumentRow(body: JsonRecord, existing: DocumentRow | null, actor: string, now: string): DocumentRow {
  const status = assertAllowedValue(
    optionalString(body.status, existing?.status ?? "draft"),
    DOCUMENT_STATUSES,
    "document status"
  ) as "draft" | "published";
  const publishedAt = optionalString(body.publishedAt, existing?.published_at ?? (status === "published" ? now : ""));

  return {
    id: optionalString(body.id, existing?.id ?? makeId("document")),
    title: requireValue(body, "title"),
    description: optionalString(body.description, existing?.description ?? ""),
    category: optionalString(body.category, existing?.category ?? ""),
    file_url: requireValue(body, "fileUrl"),
    file_name: optionalString(body.fileName, existing?.file_name ?? ""),
    media_id: optionalString(body.mediaId, existing?.media_id ?? ""),
    published_at: publishedAt,
    status,
    sort_order: normalizeInteger(body.order, existing?.sort_order ?? 0),
    pinned: normalizeBoolean(body.pinned ?? existing?.pinned) ? 1 : 0,
    updated_at: now,
    created_at: optionalString(existing?.created_at, now),
    deleted_at: "",
    created_by: optionalString(existing?.created_by, actor),
    updated_by: actor,
    revision: existing ? Number(existing.revision ?? 0) + 1 : 0
  };
}

function createHomeSectionRow(
  body: JsonRecord,
  existing: PublicHomeSectionRow | null,
  actor: string,
  now: string
): PublicHomeSectionRow {
  return {
    id: optionalString(body.id, existing?.id ?? makeId("home-section")),
    section_key: requireValue(body, "key"),
    title: requireValue(body, "title"),
    summary: optionalString(body.summary, existing?.summary ?? ""),
    href: optionalString(body.href, existing?.href ?? ""),
    sort_order: normalizeInteger(body.order, existing?.sort_order ?? 0),
    enabled: normalizeBoolean(body.enabled ?? existing?.enabled ?? true) ? 1 : 0,
    updated_at: now,
    created_at: optionalString(existing?.created_at, now),
    deleted_at: "",
    created_by: optionalString(existing?.created_by, actor),
    updated_by: actor,
    revision: existing ? Number(existing.revision ?? 0) + 1 : 0
  };
}

function createVisitorStatsRow(
  day: string,
  body: JsonRecord,
  existing: VisitorDailyStatsRow | null,
  actor: string,
  now: string
): VisitorDailyStatsRow {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new AdminHttpError("invalid visitor stats day", 400);
  }

  return {
    day,
    total_views: normalizeInteger(body.total, existing?.total_views ?? 0),
    unique_visitors: normalizeInteger(body.uniqueVisitors, existing?.unique_visitors ?? 0),
    online_users: normalizeInteger(body.onlineUsers, existing?.online_users ?? 0),
    updated_at: now,
    created_at: optionalString(existing?.created_at, now),
    updated_by: actor,
    revision: existing ? Number(existing.revision ?? 0) + 1 : 0
  };
}

async function findActiveContentSlug(env: Env, slug: string, id?: string) {
  const duplicate = id
    ? await getFirst<{ id: string }>(
        env,
        `SELECT id FROM contents
         WHERE slug = ?
           AND id <> ?
           AND COALESCE(deleted_at, '') = ''
         LIMIT 1`,
        slug,
        id
      )
    : await getFirst<{ id: string }>(
        env,
        `SELECT id FROM contents
         WHERE slug = ?
           AND COALESCE(deleted_at, '') = ''
         LIMIT 1`,
        slug
      );

  return duplicate;
}

function duplicateSlugError(detail?: string) {
  return new AdminHttpError("duplicate slug", 409, {
    resource: "content",
    field: "slug",
    ...(detail ? { detail } : {})
  });
}

async function assertUniqueContentSlug(env: Env, slug: string, id?: string) {
  const duplicate = await findActiveContentSlug(env, slug, id);

  if (duplicate) {
    throw duplicateSlugError();
  }
}

function deletedContentSlug(id: string) {
  return `${DELETED_CONTENT_SLUG_PREFIX}${id}`;
}

async function mapContentSlugConstraintError(env: Env, error: unknown, slug: string, id?: string): Promise<never> {
  const message = getErrorMessage(error);

  if (!/UNIQUE constraint failed:\s*contents\.slug/i.test(message)) {
    throw error;
  }

  const activeDuplicate = await findActiveContentSlug(env, slug, id);
  throw duplicateSlugError(
    activeDuplicate ? undefined : "A deleted content row still owns this slug at the database constraint level"
  );
}

async function assertUniqueHomeSectionKey(env: Env, sectionKey: string, id: string) {
  const duplicate = await getFirst<PublicHomeSectionRow>(
    env,
    `SELECT ${PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS.join(", ")}
     FROM public_home_sections
     WHERE section_key = ?
       AND id <> ?
       AND COALESCE(deleted_at, '') = ''
     LIMIT 1`,
    sectionKey,
    id
  );

  if (duplicate) {
    throw new AdminHttpError("duplicate home section key", 409);
  }
}

async function insertContentRow(env: Env, row: ContentRow) {
  try {
    await run(
      env,
      `INSERT INTO contents (${CONTENT_ADMIN_ROW_COLUMNS.join(", ")})
       VALUES (${CONTENT_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")})`,
      ...CONTENT_ADMIN_ROW_COLUMNS.map((column) => row[column])
    );
  } catch (error) {
    await mapContentSlugConstraintError(env, error, row.slug);
  }
}

async function updateContentRow(env: Env, row: ContentRow, expectedRevision: number | null) {
  try {
    const result = await run(
      env,
      `UPDATE contents
     SET
       slug = ?,
       type = ?,
       status = ?,
       owner = ?,
       title = ?,
       summary = ?,
       body_snapshot = ?,
       category = ?,
       tags_json = ?,
       seo_title = ?,
       seo_description = ?,
       canonical_url = ?,
       featured = ?,
       reading_minutes = ?,
       template = ?,
       body_doc_id = ?,
       body_doc_url = ?,
       featured_media_id = ?,
       media_ids_json = ?,
       view_count = ?,
       last_viewed_at = ?,
       updated_at = ?,
       publish_at = ?,
       deleted_at = ?,
       updated_by = ?,
       revision = ?
     WHERE id = ?
       AND COALESCE(deleted_at, '') = ''
       AND (? IS NULL OR revision = ?)`,
      row.slug,
      row.type,
      row.status,
      row.owner,
      row.title,
      row.summary,
      row.body_snapshot,
      row.category,
      row.tags_json,
      row.seo_title,
      row.seo_description,
      row.canonical_url,
      row.featured,
      row.reading_minutes,
      row.template,
      row.body_doc_id,
      row.body_doc_url,
      row.featured_media_id,
      row.media_ids_json,
      row.view_count,
      row.last_viewed_at,
      row.updated_at,
      row.publish_at,
      row.deleted_at,
      row.updated_by,
      row.revision,
      row.id,
      expectedRevision,
      expectedRevision
    );
    assertMutationChanged(result);
  } catch (error) {
    await mapContentSlugConstraintError(env, error, row.slug, row.id);
  }
}

async function insertDocumentRow(env: Env, row: DocumentRow) {
  await run(
    env,
    `INSERT INTO documents (${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")})
     VALUES (${DOCUMENT_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")})`,
    ...DOCUMENT_ADMIN_ROW_COLUMNS.map((column) => row[column])
  );
}

async function updateDocumentRow(env: Env, row: DocumentRow, expectedRevision: number | null) {
  const result = await run(
    env,
    `UPDATE documents
     SET
       title = ?,
       description = ?,
       category = ?,
       file_url = ?,
       file_name = ?,
       media_id = ?,
       published_at = ?,
       status = ?,
       sort_order = ?,
       pinned = ?,
       updated_at = ?,
       deleted_at = ?,
       updated_by = ?,
       revision = ?
     WHERE id = ?
       AND COALESCE(deleted_at, '') = ''
       AND (? IS NULL OR revision = ?)`,
    row.title,
    row.description,
    row.category,
    row.file_url,
    row.file_name,
    row.media_id,
    row.published_at,
    row.status,
    row.sort_order,
    row.pinned,
    row.updated_at,
    row.deleted_at,
    row.updated_by,
    row.revision,
    row.id,
    expectedRevision,
    expectedRevision
  );
  assertMutationChanged(result);
}

async function insertHomeSectionRow(env: Env, row: PublicHomeSectionRow) {
  await run(
    env,
    `INSERT INTO public_home_sections (${PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS.join(", ")})
     VALUES (${PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")})`,
    ...PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS.map((column) => row[column])
  );
}

async function updateHomeSectionRow(env: Env, row: PublicHomeSectionRow, expectedRevision: number | null) {
  const result = await run(
    env,
    `UPDATE public_home_sections
     SET
       section_key = ?,
       title = ?,
       summary = ?,
       href = ?,
       sort_order = ?,
       enabled = ?,
       updated_at = ?,
       deleted_at = ?,
       updated_by = ?,
       revision = ?
     WHERE id = ?
       AND COALESCE(deleted_at, '') = ''
       AND (? IS NULL OR revision = ?)`,
    row.section_key,
    row.title,
    row.summary,
    row.href,
    row.sort_order,
    row.enabled,
    row.updated_at,
    row.deleted_at,
    row.updated_by,
    row.revision,
    row.id,
    expectedRevision,
    expectedRevision
  );
  assertMutationChanged(result);
}

async function upsertVisitorDailyStatsRow(env: Env, row: VisitorDailyStatsRow) {
  await run(
    env,
    `INSERT INTO visitor_daily_stats (${VISITOR_DAILY_STATS_ADMIN_ROW_COLUMNS.join(", ")})
     VALUES (${VISITOR_DAILY_STATS_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")})
     ON CONFLICT(day) DO UPDATE SET
       total_views = excluded.total_views,
       unique_visitors = excluded.unique_visitors,
       online_users = excluded.online_users,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by,
       revision = excluded.revision`,
    ...VISITOR_DAILY_STATS_ADMIN_ROW_COLUMNS.map((column) => row[column])
  );
}

async function getContentById(env: Env, id: string) {
  return getFirst<ContentRow>(
    env,
    `SELECT ${CONTENT_ADMIN_ROW_COLUMNS.join(", ")}
     FROM contents
     WHERE id = ?
       AND COALESCE(deleted_at, '') = ''
     LIMIT 1`,
    id
  );
}

async function getContentByIdAny(env: Env, id: string) {
  return getFirst<ContentRow>(
    env,
    `SELECT ${CONTENT_ADMIN_ROW_COLUMNS.join(", ")}
     FROM contents
     WHERE id = ?
     LIMIT 1`,
    id
  );
}

async function getDocumentById(env: Env, id: string) {
  return getFirst<DocumentRow>(
    env,
    `SELECT ${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")}
     FROM documents
     WHERE id = ?
       AND COALESCE(deleted_at, '') = ''
     LIMIT 1`,
    id
  );
}

async function getDocumentByIdAny(env: Env, id: string) {
  return getFirst<DocumentRow>(
    env,
    `SELECT ${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")}
     FROM documents
     WHERE id = ?
     LIMIT 1`,
    id
  );
}

async function getHomeSectionById(env: Env, id: string) {
  return getFirst<PublicHomeSectionRow>(
    env,
    `SELECT ${PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS.join(", ")}
     FROM public_home_sections
     WHERE id = ?
       AND COALESCE(deleted_at, '') = ''
     LIMIT 1`,
    id
  );
}

async function getHomeSectionByIdAny(env: Env, id: string) {
  return getFirst<PublicHomeSectionRow>(
    env,
    `SELECT ${PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS.join(", ")}
     FROM public_home_sections
     WHERE id = ?
     LIMIT 1`,
    id
  );
}

async function getVisitorDailyStatsByDay(env: Env, day: string) {
  return getFirst<VisitorDailyStatsRow>(
    env,
    `SELECT ${VISITOR_DAILY_STATS_ADMIN_ROW_COLUMNS.join(", ")}
     FROM visitor_daily_stats
     WHERE day = ?
     LIMIT 1`,
    day
  );
}

async function handleContent(request: Request, env: Env, segments: string[], identity: AdminIdentity) {
  const actor = identity.actor;
  const now = new Date().toISOString();

  if (segments.length === 1 && request.method === "GET") {
    const rows = await getAll<ContentRow>(
      env,
      `SELECT ${CONTENT_ADMIN_ROW_COLUMNS.join(", ")}
       FROM contents
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY updated_at DESC`
    );
    return json({ items: rows.map(mapContentRowToAdminItem), generatedAt: now });
  }

  if (segments.length === 1 && request.method === "POST") {
    const body = await parseJsonBody(request);
    const existing = body.id ? await getContentByIdAny(env, String(body.id)) : null;

    if (existing) {
      throw new AdminHttpError("duplicate content id", 409);
    }

    const row = createContentRow(body, null, actor, now);

    await assertUniqueContentSlug(env, row.slug);
    await insertContentRow(env, row);
    return json({ item: mapContentRowToAdminItem(row) }, { status: 201 });
  }

  if (segments.length === 1) {
    return adminMethodNotAllowed();
  }

  const id = segments[1];
  const action = segments[2];

  if (!id) {
    return notFoundAdmin();
  }

  if (segments.length === 2 && request.method === "GET") {
    const row = await getContentById(env, id);

    return row ? json({ item: mapContentRowToAdminItem(row) }) : notFoundAdmin();
  }

  if (segments.length === 2 && request.method === "PATCH") {
    const existing = await getContentById(env, id);

    if (!existing) {
      return notFoundAdmin();
    }

    const body = await parseJsonBody(request);
    const expectedRevision = getExpectedRevisionFromRequest(request, body);
    const row = createContentRow({ ...mapContentRowToAdminItem(existing), ...body, id }, existing, actor, now);

    await assertUniqueContentSlug(env, row.slug, row.id);
    await updateContentRow(env, row, expectedRevision);
    return json({ item: mapContentRowToAdminItem(row) });
  }

  if (segments.length === 2 && request.method === "DELETE") {
    const existing = await getContentById(env, id);

    if (!existing) {
      return notFoundAdmin();
    }

    const expectedRevision = getExpectedRevisionFromRequest(request);
    const result = await run(
      env,
      `UPDATE contents
       SET slug = ?, deleted_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
         AND (? IS NULL OR revision = ?)`,
      deletedContentSlug(id),
      now,
      now,
      actor,
      id,
      expectedRevision,
      expectedRevision
    );
    assertMutationChanged(result);
    return json({ id, deleted: true });
  }

  if (segments.length === 3 && request.method === "POST" && (action === "publish" || action === "unpublish")) {
    const body = await parseJsonBody(request);
    const expectedRevision = getExpectedRevisionFromRequest(request, body);
    const context: AdminRouteErrorContext = {
      contentId: id,
      expectedRevisionPresent: expectedRevision !== null,
      operation: action,
      routeGroup: "content",
      route: action === "publish" ? "content.publish" : "content.unpublish"
    };

    return withAdminRouteContext(context, async () => {
      const existing = await getContentById(env, id);

      if (!existing) {
        return notFoundAdmin();
      }

      const status = action === "publish" ? "published" : "draft";
      const result = await run(
        env,
        `UPDATE contents
       SET status = ?, publish_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
         AND (? IS NULL OR revision = ?)`,
        status,
        normalizeContentPublishAt(action, existing.publish_at, now),
        now,
        actor,
        id,
        expectedRevision,
        expectedRevision
      );
      await assertContentPublishChanged(env, result, id, expectedRevision);
      return json({ id, published: action === "publish" });
    });
  }

  return adminMethodNotAllowed();
}

async function handleDocuments(request: Request, env: Env, segments: string[], identity: AdminIdentity) {
  const actor = identity.actor;
  const now = new Date().toISOString();

  if (segments.length === 1 && request.method === "GET") {
    const rows = await getAll<DocumentRow>(
      env,
      `SELECT ${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")}
       FROM documents
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY pinned DESC, sort_order ASC, published_at DESC, updated_at DESC`
    );
    return json({ items: rows.map(mapDocumentRowToAdminItem), generatedAt: now });
  }

  if (segments.length === 1 && request.method === "POST") {
    const body = await parseJsonBody(request);
    const existing = body.id ? await getDocumentByIdAny(env, String(body.id)) : null;

    if (existing) {
      throw new AdminHttpError("duplicate document id", 409);
    }

    const row = createDocumentRow(body, null, actor, now);

    await insertDocumentRow(env, row);
    return json({ item: mapDocumentRowToAdminItem(row) }, { status: 201 });
  }

  if (segments.length === 1) {
    return adminMethodNotAllowed();
  }

  const id = segments[1];
  const action = segments[2];

  if (!id) {
    return notFoundAdmin();
  }

  if (segments.length === 2 && request.method === "GET") {
    const row = await getDocumentById(env, id);

    return row ? json({ item: mapDocumentRowToAdminItem(row) }) : notFoundAdmin();
  }

  if (segments.length === 2 && request.method === "PATCH") {
    const existing = await getDocumentById(env, id);

    if (!existing) {
      return notFoundAdmin();
    }

    const body = await parseJsonBody(request);
    const expectedRevision = getExpectedRevisionFromRequest(request, body);
    const row = createDocumentRow({ ...mapDocumentRowToAdminItem(existing), ...body, id }, existing, actor, now);

    await updateDocumentRow(env, row, expectedRevision);
    return json({ item: mapDocumentRowToAdminItem(row) });
  }

  if (segments.length === 2 && request.method === "DELETE") {
    const existing = await getDocumentById(env, id);

    if (!existing) {
      return notFoundAdmin();
    }

    const expectedRevision = getExpectedRevisionFromRequest(request);
    const result = await run(
      env,
      `UPDATE documents
       SET deleted_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
         AND (? IS NULL OR revision = ?)`,
      now,
      now,
      actor,
      id,
      expectedRevision,
      expectedRevision
    );
    assertMutationChanged(result);
    return json({ id, deleted: true });
  }

  if (segments.length === 3 && request.method === "POST" && (action === "publish" || action === "unpublish")) {
    const existing = await getDocumentById(env, id);

    if (!existing) {
      return notFoundAdmin();
    }

    const status = action === "publish" ? "published" : "draft";
    const body = await parseJsonBody(request);
    const expectedRevision = getExpectedRevisionFromRequest(request, body);
    const result = await run(
      env,
      `UPDATE documents
       SET status = ?, published_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
         AND (? IS NULL OR revision = ?)`,
      status,
      action === "publish" ? existing.published_at || now : existing.published_at || "",
      now,
      actor,
      id,
      expectedRevision,
      expectedRevision
    );
    assertMutationChanged(result);
    return json({ id, published: action === "publish" });
  }

  return adminMethodNotAllowed();
}

async function handleHomeSections(request: Request, env: Env, segments: string[], identity: AdminIdentity) {
  const actor = identity.actor;
  const now = new Date().toISOString();

  if (segments.length === 1 && request.method === "GET") {
    const rows = await getAll<PublicHomeSectionRow>(
      env,
      `SELECT ${PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS.join(", ")}
       FROM public_home_sections
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY sort_order ASC, updated_at DESC`
    );
    return json({ items: rows.map(mapHomeSectionRowToAdminItem), generatedAt: now });
  }

  if (segments.length === 1 && request.method === "POST") {
    const body = await parseJsonBody(request);
    const existing = body.id ? await getHomeSectionByIdAny(env, String(body.id)) : null;

    if (existing) {
      throw new AdminHttpError("duplicate home section id", 409);
    }

    const row = createHomeSectionRow(body, null, actor, now);

    await assertUniqueHomeSectionKey(env, row.section_key, row.id);
    await insertHomeSectionRow(env, row);
    return json({ item: mapHomeSectionRowToAdminItem(row) }, { status: 201 });
  }

  const id = segments[1];

  if (!id) {
    return notFoundAdmin();
  }

  if (segments.length === 2 && request.method === "PATCH") {
    const existing = await getHomeSectionById(env, id);

    if (!existing) {
      return notFoundAdmin();
    }

    const body = await parseJsonBody(request);
    const expectedRevision = getExpectedRevisionFromRequest(request, body);
    const row = createHomeSectionRow({ ...mapHomeSectionRowToAdminItem(existing), ...body, id }, existing, actor, now);

    await assertUniqueHomeSectionKey(env, row.section_key, row.id);
    await updateHomeSectionRow(env, row, expectedRevision);
    return json({ item: mapHomeSectionRowToAdminItem(row) });
  }

  if (segments.length === 2 && request.method === "DELETE") {
    const existing = await getHomeSectionById(env, id);

    if (!existing) {
      return notFoundAdmin();
    }

    const expectedRevision = getExpectedRevisionFromRequest(request);
    const result = await run(
      env,
      `UPDATE public_home_sections
       SET enabled = ?, deleted_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
         AND (? IS NULL OR revision = ?)`,
      0,
      now,
      now,
      actor,
      id,
      expectedRevision,
      expectedRevision
    );
    assertMutationChanged(result);
    return json({ id, deleted: true });
  }

  return adminMethodNotAllowed();
}

async function handleVisitorStats(request: Request, env: Env, segments: string[], identity: AdminIdentity) {
  const actor = identity.actor;
  const now = new Date().toISOString();

  if (segments[1] !== "daily") {
    return notFoundAdmin();
  }

  if (segments.length === 2 && request.method === "GET") {
    const rows = await getAll<VisitorDailyStatsRow>(
      env,
      `SELECT ${VISITOR_DAILY_STATS_ADMIN_ROW_COLUMNS.join(", ")}
       FROM visitor_daily_stats
       ORDER BY day DESC`
    );
    return json({ items: rows.map(mapVisitorDailyStatsRowToAdminItem), generatedAt: now });
  }

  const day = segments[2];

  if (!day) {
    return notFoundAdmin();
  }

  if (segments.length === 3 && request.method === "PUT") {
    const existing = await getVisitorDailyStatsByDay(env, day);
    const body = await parseJsonBody(request);
    const row = createVisitorStatsRow(day, body, existing, actor, now);

    await upsertVisitorDailyStatsRow(env, row);
    return json({ item: mapVisitorDailyStatsRowToAdminItem(row) }, { status: existing ? 200 : 200 });
  }

  if (segments.length === 3 && request.method === "DELETE") {
    const expectedRevision = getExpectedRevisionFromRequest(request);
    const result = await run(
      env,
      `DELETE FROM visitor_daily_stats
       WHERE day = ?
         AND (? IS NULL OR revision = ?)`,
      day,
      expectedRevision,
      expectedRevision
    );

    assertMutationChanged(result);
    return json({ id: day, deleted: true });
  }

  return adminMethodNotAllowed();
}

function normalizeEmail(value: unknown) {
  return trimString(value).toLowerCase();
}

async function getActiveAdminCount(env: Env) {
  const rows = await getAll<Pick<AdminUserRow, "id">>(
    env,
    "SELECT id FROM app_admin_users WHERE role = ? AND status = ?",
    "admin",
    "active"
  );

  return rows.length;
}

async function assertActiveAdminRemains(
  env: Env,
  current: SafeAdminUserLifecycle,
  next: Pick<SafeAdminUserLifecycle, "role" | "status"> | null
) {
  const removesActiveAdmin =
    current.role === "admin" &&
    current.status === "active" &&
    (!next || next.role !== "admin" || next.status !== "active");

  if (removesActiveAdmin && (await getActiveAdminCount(env)) <= 1) {
    throw new AdminHttpError("ต้องมีผู้ดูแลระบบที่ใช้งานอย่างน้อยหนึ่งบัญชี", 403, {
      resource: "admin-users"
    });
  }
}

function containsControlCharacter(value: string) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function validateAdminUserEmail(value: unknown) {
  const email = normalizeEmail(value);

  if (!email || email.length > 320 || containsControlCharacter(email) || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new AdminHttpError("user email is invalid", 400, { resource: "admin-users", field: "email" });
  }

  return email;
}

function validateAdminUserName(value: unknown) {
  const name = trimString(value);

  if (!name || name.length > 160 || containsControlCharacter(name)) {
    throw new AdminHttpError("user name is invalid", 400, { resource: "admin-users", field: "name" });
  }

  return name;
}

function validateAdminUsername(value: unknown, optional = true) {
  if (value === undefined || value === null || value === "") {
    if (optional) return null;
    throw new AdminHttpError("username is invalid", 400, { resource: "admin-users", field: "username" });
  }

  if (typeof value !== "string") {
    throw new AdminHttpError("username is invalid", 400, { resource: "admin-users", field: "username" });
  }

  const username = value.trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw new AdminHttpError("username is invalid", 400, { resource: "admin-users", field: "username" });
  }

  return username;
}

function validateAdminUserRole(value: unknown) {
  const role = trimString(value);

  if (!ADMIN_USER_ROLES.has(role)) {
    throw new AdminHttpError("invalid user role", 400, { resource: "admin-users", field: "role" });
  }

  return role as AdminUserRow["role"];
}

function validateAdminUserStatus(value: unknown) {
  const status = trimString(value);

  if (!ADMIN_USER_STATUSES.has(status)) {
    throw new AdminHttpError("invalid user status", 400, { resource: "admin-users", field: "status" });
  }

  return status as AdminUserRow["status"];
}

function rejectUnexpectedUserCreateFields(body: JsonRecord) {
  const allowed = new Set(["email", "name", "role", "username"]);

  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw new AdminHttpError("request contains protected user fields", 400, { resource: "admin-users" });
  }
}

function makeInvitationRow(userId: string, tokenHash: string, actor: string, now: Date): AdminUserInvitationRow {
  const createdAt = now.toISOString();
  return {
    id: makeId("admin-invitation"),
    user_id: userId,
    token_hash: tokenHash,
    created_by: actor,
    created_at: createdAt,
    expires_at: new Date(now.getTime() + CMS_INVITATION_LIFETIME_SECONDS * 1000).toISOString(),
    accepted_at: "",
    revoked_at: "",
    request_ip_hash: ""
  };
}

function makePasswordResetRow(userId: string, tokenHash: string, now: Date): AdminPasswordResetTokenRow {
  const createdAt = now.toISOString();
  return {
    id: makeId("admin-password-reset"),
    user_id: userId,
    token_hash: tokenHash,
    created_at: createdAt,
    expires_at: new Date(now.getTime() + CMS_PASSWORD_RESET_LIFETIME_SECONDS * 1000).toISOString(),
    used_at: "",
    revoked_at: "",
    request_ip_hash: ""
  };
}

function noStoreAdmin(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function mapLifecycleConflict(error: unknown): never {
  if (!(error instanceof AdminUserLifecycleConflict)) {
    throw error;
  }

  if (error.code === "duplicate_email") {
    throw new AdminHttpError("duplicate user email", 409, { resource: "admin-users", field: "email" });
  }

  if (error.code === "duplicate_username") {
    throw new AdminHttpError("username is already in use", 409, { resource: "admin-users", field: "username" });
  }

  if (error.code === "credential_configured") {
    throw new AdminHttpError("credential is already configured", 409, { resource: "admin-users" });
  }

  if (error.code === "stale_revision") {
    throw new AdminHttpError("stale revision", 409, { resource: "admin-users" });
  }

  throw new AdminHttpError("user lifecycle operation is not available", 409, { resource: "admin-users" });
}

function isSelfUser(identity: AdminIdentity, row: SafeAdminUserLifecycle) {
  if (identity.mode === "cms-session") {
    return Boolean(identity.userId) && identity.userId === row.id;
  }

  return normalizeEmail(identity.email) === normalizeEmail(row.email);
}

function userManagementDenied() {
  const response = jsonError("required permission is missing", 403, {
    resource: "admin-users"
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function hasUnsafeSelfUserUpdateFields(body: JsonRecord) {
  return Object.keys(body).some((field) => !SELF_USER_UPDATE_FIELDS.has(field));
}

async function handleUsers(
  request: Request,
  env: Env,
  segments: string[],
  identity: AdminIdentity,
  updateAuthorization: AdminUserUpdateAuthorization | null
) {
  const actor = identity.actor;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const repository = createAdminUserLifecycleRepository(env);

  if (segments.length === 2 && segments[1] === "me" && request.method === "GET") {
    const row =
      identity.mode === "cms-session" && identity.userId
        ? await repository.readSafeUserLifecycleStatus(identity.userId, now)
        : await repository.readSafeUserLifecycleStatusByEmail(identity.email, now);
    return row ? noStoreAdmin(json({ item: row })) : notFoundAdmin();
  }

  if (segments.length === 1 && request.method === "POST") {
    const body = await parseJsonBody(request);
    rejectUnexpectedUserCreateFields(body);
    const userId = makeId("admin-user");
    const rawToken = generateInvitationToken();
    const invitation = makeInvitationRow(userId, await hashInvitationToken(rawToken), actor, nowDate);

    try {
      await repository.createUserWithInvitation({
        user: {
          id: userId,
          email: validateAdminUserEmail(body.email),
          name: validateAdminUserName(body.name),
          role: validateAdminUserRole(body.role),
          username: validateAdminUsername(body.username)
        },
        invitation,
        actor,
        now
      });
    } catch (error) {
      mapLifecycleConflict(error);
    }

    const item = await repository.readSafeUserLifecycleStatus(userId, now);
    return noStoreAdmin(
      json(
        {
          item,
          invitation: { token: rawToken, expiresAt: invitation.expires_at, delivery: "manual" }
        },
        { status: 201 }
      )
    );
  }

  const id = segments[1];

  if (!id || segments.length > 3) {
    return notFoundAdmin();
  }

  if (
    request.method === "PATCH" &&
    updateAuthorization?.scope === "self" &&
    identity.mode === "cms-session" &&
    identity.userId !== id
  ) {
    return userManagementDenied();
  }

  const existing = await repository.readSafeUserLifecycleStatus(id, now);

  if (!existing) {
    return notFoundAdmin();
  }

  if (segments.length === 3) {
    const action = segments[2];

    if (action === "invitations" && request.method === "POST") {
      if (existing.isRoot || existing.status !== "active") {
        throw new AdminHttpError("invitation is not available for this user", 409, { resource: "admin-users" });
      }

      if (existing.credentialConfigured) {
        throw new AdminHttpError("credential is already configured", 409, { resource: "admin-users" });
      }

      const rawToken = generateInvitationToken();
      const invitation = makeInvitationRow(id, await hashInvitationToken(rawToken), actor, nowDate);

      try {
        await repository.issueInvitationForExistingUser({ userId: id, actor, token: invitation, now });
      } catch (error) {
        mapLifecycleConflict(error);
      }

      return noStoreAdmin(
        json({ invitation: { token: rawToken, expiresAt: invitation.expires_at, delivery: "manual" } }, { status: 201 })
      );
    }

    if (action === "invitations" && request.method === "DELETE") {
      if (existing.isRoot) {
        throw new AdminHttpError("Root invitations cannot be revoked", 403, { resource: "admin-users" });
      }

      await repository.revokePendingInvitations(id, actor, now);
      return noStoreAdmin(json({ ok: true, revoked: true }));
    }

    if (action === "password-reset" && request.method === "POST") {
      if (existing.isRoot || existing.status !== "active" || !existing.credentialConfigured) {
        throw new AdminHttpError("password reset is not available for this user", 409, { resource: "admin-users" });
      }

      const rawToken = generatePasswordResetToken();
      const reset = makePasswordResetRow(id, await hashPasswordResetToken(rawToken), nowDate);

      try {
        await repository.issuePasswordReset({ userId: id, actor, token: reset, now });
      } catch (error) {
        mapLifecycleConflict(error);
      }

      return noStoreAdmin(
        json({ passwordReset: { token: rawToken, expiresAt: reset.expires_at, delivery: "manual" } }, { status: 201 })
      );
    }

    if (action === "revoke-sessions" && request.method === "POST") {
      if (existing.isRoot && !isSelfUser(identity, existing)) {
        throw new AdminHttpError("only Root may revoke Root Sessions", 403, { resource: "admin-users" });
      }

      try {
        await repository.revokeUserSessions(id, actor, now);
      } catch (error) {
        mapLifecycleConflict(error);
      }

      return noStoreAdmin(json({ ok: true, revoked: true }));
    }

    return notFoundAdmin();
  }

  if (request.method === "GET") {
    return noStoreAdmin(json({ item: existing }));
  }

  if (request.method === "PATCH") {
    if (!updateAuthorization) {
      return userManagementDenied();
    }

    if (updateAuthorization.scope === "self" && !isSelfUser(identity, existing)) {
      return userManagementDenied();
    }

    const body = await parseJsonBody(request);

    if (updateAuthorization.scope === "self" && hasUnsafeSelfUserUpdateFields(body)) {
      return userManagementDenied();
    }

    if (
      updateAuthorization.scope === "any" &&
      Object.keys(body).some((field) => !ADMIN_USER_UPDATE_FIELDS.has(field))
    ) {
      throw new AdminHttpError("request contains protected user fields", 400, { resource: "admin-users" });
    }

    const expectedRevision = getExpectedRevisionFromRequest(request, body);
    const role =
      updateAuthorization.scope === "self" ? existing.role : validateAdminUserRole(body.role ?? existing.role);
    const status =
      updateAuthorization.scope === "self" ? existing.status : validateAdminUserStatus(body.status ?? existing.status);
    const next = { role, status };

    if (existing.isRoot && (role !== "admin" || status !== "active")) {
      throw new AdminHttpError("root administrator is protected", 403, { resource: "admin-users" });
    }

    await assertActiveAdminRemains(env, existing, next);
    const email =
      updateAuthorization.scope === "self" ? existing.email : validateAdminUserEmail(body.email ?? existing.email);
    const name = validateAdminUserName(body.name ?? existing.name);
    const username =
      updateAuthorization.scope === "self" || !Object.prototype.hasOwnProperty.call(body, "username")
        ? existing.username
        : validateAdminUsername(body.username);

    if (!(await repository.isUsernameAvailable(username ?? "", id)) && username) {
      throw new AdminHttpError("username is already in use", 409, { resource: "admin-users", field: "username" });
    }

    const emailChanged = email !== existing.email.toLowerCase();
    const statusChanged = status !== existing.status;
    const securitySensitive = emailChanged || username !== existing.username || role !== existing.role || statusChanged;

    try {
      await repository.updateUserWithSecurityRevocation({
        userId: id,
        email,
        name,
        role,
        status,
        username,
        actor,
        now,
        expectedRevision,
        securitySensitive,
        revokeInvitations: emailChanged || status === "disabled"
      });
    } catch (error) {
      mapLifecycleConflict(error);
    }

    const item = await repository.readSafeUserLifecycleStatus(id, now);
    return noStoreAdmin(json({ item }));
  }

  if (request.method === "DELETE") {
    if (isSelfUser(identity, existing)) {
      return jsonError("ไม่สามารถลบบัญชีของตนเองได้", 403, {
        resource: "admin-users"
      });
    }

    const expectedRevision = getExpectedRevisionFromRequest(request);

    if (existing.isRoot) {
      throw new AdminHttpError("root administrator is protected", 403, { resource: "admin-users" });
    }

    await assertActiveAdminRemains(env, existing, null);
    try {
      await repository.deleteUserWithAudit(existing, actor, now, expectedRevision);
    } catch (error) {
      mapLifecycleConflict(error);
    }
    return json({ id, deleted: true });
  }

  return adminMethodNotAllowed();
}

async function handleSnapshot(env: Env) {
  const [contentRows, documentRows, visitorRows, structured] = await Promise.all([
    getAll<ContentRow>(
      env,
      `SELECT ${CONTENT_ADMIN_ROW_COLUMNS.join(", ")}
       FROM contents
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY updated_at DESC`
    ),
    getAll<DocumentRow>(
      env,
      `SELECT ${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")}
       FROM documents
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY pinned DESC, sort_order ASC, published_at DESC, updated_at DESC`
    ),
    getAll<VisitorDailyStatsRow>(
      env,
      `SELECT ${VISITOR_DAILY_STATS_ADMIN_ROW_COLUMNS.join(", ")}
       FROM visitor_daily_stats
       ORDER BY day DESC`
    ),
    readAdminStructuredSnapshot(env)
  ]);
  const publishedCount = contentRows.filter((row) => row.status === "published").length;
  const reviewCount = contentRows.filter((row) => row.status === "review").length;

  return json({
    metrics: [
      {
        id: "published-content",
        label: "Published content",
        value: String(publishedCount),
        trend: `${contentRows.length} total records`,
        tone: "blue"
      },
      {
        id: "review-queue",
        label: "Review queue",
        value: String(reviewCount),
        trend: "D1 structured content",
        tone: "amber"
      },
      {
        id: "media-assets",
        label: "Media metadata",
        value: String(structured.media.length),
        trend: "Drive bridge references",
        tone: "green"
      }
    ],
    content: contentRows.map(mapContentRowToAdminItem),
    documents: documentRows.map(mapDocumentRowToAdminItem),
    ...structured,
    visitorStats: createPublicVisitorStatsSnapshot(visitorRows),
    generatedAt: new Date().toISOString()
  });
}

function adminMethodNotAllowed() {
  const response = methodNotAllowed();
  response.headers.set("Allow", ADMIN_ALLOW);
  return response;
}

function notFoundAdmin() {
  return jsonError("not found", 404, {
    resource: "admin-structured-data"
  });
}

function safeAdminError(error: unknown, env: Env, fallbackContext: AdminRouteErrorContext) {
  const cause = getErrorCause(error);

  if (isAdminHttpError(cause)) {
    return jsonError(cause.message, cause.status, {
      resource: "admin-structured-data",
      ...cause.details
    });
  }

  const message = getErrorMessage(cause);

  if (/UNIQUE constraint failed:\s*contents\.slug/i.test(message) || message === "duplicate slug") {
    return jsonError("duplicate slug", 409, {
      resource: "content",
      field: "slug"
    });
  }

  if (message === "stale revision" || message.includes("duplicate ")) {
    return jsonError(message, 409, {
      resource: "admin-structured-data"
    });
  }

  if (
    message.startsWith("missing required field:") ||
    message.startsWith("invalid ") ||
    message.includes("malformed JSON") ||
    message.includes("request body must be") ||
    message.endsWith(" is required")
  ) {
    return jsonError(message, 400, {
      resource: "admin-structured-data"
    });
  }

  const context = { ...fallbackContext, ...(getErrorContext(error) ?? {}) };

  if (shouldIncludePreviewDiagnostics(env)) {
    return jsonError("admin structured write failed", 500, {
      resource: "admin-structured-data",
      diagnostic: "admin-structured-write-unhandled-v3",
      routeGroup: context.routeGroup,
      operation: context.operation,
      errorName: getErrorName(cause),
      errorMessage: sanitizeDiagnosticText(message),
      ...(context.route ? { route: context.route } : {}),
      ...(context.contentId ? { contentId: context.contentId } : {}),
      ...(context.expectedRevisionPresent === undefined
        ? {}
        : { expectedRevisionPresent: context.expectedRevisionPresent })
    });
  }

  return jsonError("admin structured write failed", 500, {
    resource: "admin-structured-data"
  });
}

export async function adminWrite(request: Request, env: Env): Promise<Response | null> {
  const { pathname } = new URL(request.url);

  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
    return adminMethodNotAllowed();
  }

  const originResponse = requireAllowedAdminOrigin(request, env);

  if (originResponse) {
    return originResponse;
  }

  const authResult = await authenticateAdminRequest(request, env);

  if (authResult.response || !authResult.identity) {
    return (
      authResult.response ??
      jsonError("admin authentication failed", 403, {
        resource: "admin-structured-data"
      })
    );
  }

  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: "admin-structured-data"
    });
  }

  const segments = pathname.slice(ADMIN_PREFIX.length).split("/");
  const routeContext = getAdminRouteContext(request, segments);
  const routePolicy = resolveAdminRoutePolicy(request.method, segments);

  if (!routePolicy.matched) {
    return isSupportedAdminRoutePath(segments) ? adminMethodNotAllowed() : notFoundAdmin();
  }

  let permissionResponse: Response | null;
  let userUpdateAuthorization: AdminUserUpdateAuthorization | null = null;

  if ("capability" in routePolicy) {
    permissionResponse = requireAdminCapability(authResult.identity, routePolicy.capability, {
      resource: routePolicy.resource
    });
  } else {
    permissionResponse = requireAnyAdminCapability(authResult.identity, routePolicy.anyOf, {
      resource: routePolicy.resource
    });

    if (!permissionResponse) {
      userUpdateAuthorization = hasAdminCapability(authResult.identity, "users.update-any")
        ? { capability: "users.update-any", scope: "any" }
        : { capability: "users.update-self", scope: "self" };
    }
  }

  if (permissionResponse) {
    return permissionResponse;
  }

  try {
    const schemaMismatch = await getPreviewSchemaMismatch(env, request, segments);

    if (schemaMismatch) {
      return jsonError("admin structured write failed", 500, {
        resource: "admin-structured-data",
        diagnostic: "admin-structured-schema-mismatch-v1",
        table: schemaMismatch.table,
        missingColumns: schemaMismatch.missingColumns
      });
    }

    const adminAuthResponse = await handleAdminAuth(request, env, segments, authResult.identity);

    if (adminAuthResponse) {
      return adminAuthResponse;
    }

    if (segments[0] === "snapshot" && segments.length === 1 && request.method === "GET") {
      return await handleSnapshot(env);
    }

    if (segments[0] === "capabilities" && segments.length === 1 && request.method === "GET") {
      return json(
        {
          role: authResult.identity.role,
          capabilities: [...getCapabilitiesForRole(authResult.identity.role)].sort()
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const paginatedResponse = await handleAdminPaginatedReads(request, env, segments, authResult.identity);

    if (paginatedResponse) {
      return paginatedResponse;
    }

    const backupResponse = await handleAdminBackup(request, env, segments);

    if (backupResponse) {
      return backupResponse;
    }

    if (segments[0] === "content") {
      return await handleContent(request, env, segments, authResult.identity);
    }

    if (segments[0] === "documents") {
      return await handleDocuments(request, env, segments, authResult.identity);
    }

    if (segments[0] === "home-sections") {
      return await handleHomeSections(request, env, segments, authResult.identity);
    }

    if (segments[0] === "visitor-stats") {
      return await handleVisitorStats(request, env, segments, authResult.identity);
    }

    if (segments[0] === "users") {
      return await handleUsers(request, env, segments, authResult.identity, userUpdateAuthorization);
    }

    const structuredResponse = await handleAdminStructuredParity(request, env, segments, authResult.identity);

    if (structuredResponse) {
      return structuredResponse;
    }

    if (segments[0] === "public-content-contract" && request.method === "GET") {
      const rows = await listPublishedContentRows(env, "news");
      return json(createPublicContentListSnapshot("news", rows, [], createEmptyPublicMetadata()));
    }

    if (segments[0] === "public-document-contract" && request.method === "GET") {
      const rows = await listPublishedDocumentRows(env);
      return json(createPublicDocumentListSnapshot(rows));
    }

    return notFoundAdmin();
  } catch (error) {
    const response = safeAdminError(error, env, routeContext);

    if (segments[0] === "users") {
      response.headers.set("Cache-Control", "no-store");
    }

    return response;
  }
}
