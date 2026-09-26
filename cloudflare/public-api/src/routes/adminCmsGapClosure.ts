import { authenticateAdminRequest, type AdminIdentity } from "../auth/adminAccess";
import { requireAdminCapability, type AdminCapability } from "../auth/adminCapabilities";
import { hasRecentAdminAssurance } from "../auth/adminStepUp";
import { requireD1Database } from "../db/documentsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import {
  SecurityRateLimitExceeded,
  SecurityRateLimitUnavailable,
  enforceSecurityRateLimit
} from "../securityRateLimit";

const ADMIN_PREFIX = "/api/admin/";
const MAX_REDIRECTS = 250;
const MAX_SCOPE_LENGTH = 160;
const MAX_TAXONOMY_LENGTH = 120;
const MAX_RECOVERY_BYTES = 16 * 1024 * 1024;
const RECOVERY_BATCH_SIZE = 100;
const RECOVERY_TABLES = [
  "contents",
  "media_assets",
  "documents",
  "menu_items",
  "carousel_slides",
  "external_services",
  "events",
  "site_settings",
  "homepage_settings",
  "display_settings",
  "public_home_sections",
  "visitor_daily_stats",
  "content_redirects"
] as const;

type JsonRecord = Record<string, unknown>;
type TaxonomyKind = "category" | "tag";
type RecoveryTable = (typeof RECOVERY_TABLES)[number];

interface ContentRedirectRow {
  old_slug: string;
  new_slug: string;
  content_id: string;
  created_at: string;
  updated_at: string;
}

interface TaxonomyContentRow {
  id: string;
  owner: string;
  category: string;
  tags_json: string;
}

interface ContentScopeRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  content_scope: string;
}

function noStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function normalizeText(value: unknown, maximumLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function normalizeComparable(value: string) {
  return value.trim().toLocaleLowerCase("th-TH");
}

function parseJsonArray(value: string) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function uniqueCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = normalizeComparable(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function splitCategories(value: string) {
  return uniqueCaseInsensitive(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function parseJsonRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

async function authenticateFor(
  request: Request,
  env: Env,
  capability: AdminCapability,
  resource: string,
  assurance?: "password" | "mfa"
): Promise<AdminIdentity | Response> {
  const auth = await authenticateAdminRequest(request, env);
  if (auth.response || !auth.identity) return auth.response ?? jsonError("admin authentication failed", 403);
  const denied = requireAdminCapability(auth.identity, capability, { resource });
  if (denied) return denied;

  try {
    await enforceSecurityRateLimit(request, env, "admin-api");
  } catch (error) {
    if (error instanceof SecurityRateLimitExceeded) {
      const response = jsonError("too many admin requests", 429, { resource });
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return noStore(response);
    }
    if (error instanceof SecurityRateLimitUnavailable) {
      return noStore(jsonError("admin security service is unavailable", 503, { resource }));
    }
    throw error;
  }

  if (assurance && !hasRecentAdminAssurance(auth.identity, assurance)) {
    return noStore(
      jsonError("reauthentication required", 428, {
        resource,
        assurance
      })
    );
  }

  return auth.identity;
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

async function getEditorScope(env: Env, identity: AdminIdentity) {
  if (identity.role !== "editor") return "";
  const row = await requireD1Database(env)
    .prepare("SELECT content_scope FROM app_admin_users WHERE id = ? LIMIT 1")
    .bind(identity.userId)
    .first<{ content_scope: string }>();
  return normalizeText(row?.content_scope, MAX_SCOPE_LENGTH);
}

function scopeDenied(scope: string) {
  return noStore(
    jsonError("content is outside the editor scope", 403, {
      resource: "content",
      scope
    })
  );
}

export async function enforceAdminContentScope(request: Request, env: Env): Promise<Response | null> {
  if (!env.DB || !["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) return null;
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(`${ADMIN_PREFIX}content`)) return null;
  const segments = pathname.slice(ADMIN_PREFIX.length).split("/");
  if (segments[0] !== "content") return null;

  const auth = await authenticateAdminRequest(request, env, { touchSession: false });
  if (auth.response || !auth.identity) return auth.response ?? noStore(jsonError("admin authentication failed", 403));
  if (auth.identity.role !== "editor") return null;

  const scope = await getEditorScope(env, auth.identity);
  if (!scope) return null;

  if (segments.length === 1 && request.method === "POST") {
    const body = parseJsonRecord(
      await request
        .clone()
        .json()
        .catch(() => null)
    );
    const owner = normalizeText(body?.owner, MAX_SCOPE_LENGTH);
    return normalizeComparable(owner) === normalizeComparable(scope) ? null : scopeDenied(scope);
  }

  const contentId = decodeURIComponent(segments[1] || "");
  if (!contentId) return null;
  const row = await requireD1Database(env)
    .prepare("SELECT owner FROM contents WHERE id = ? LIMIT 1")
    .bind(contentId)
    .first<{ owner: string }>();
  if (!row) return null;
  if (normalizeComparable(row.owner || "") !== normalizeComparable(scope)) return scopeDenied(scope);

  if (request.method === "PATCH") {
    const body = parseJsonRecord(
      await request
        .clone()
        .json()
        .catch(() => null)
    );
    if (body && Object.prototype.hasOwnProperty.call(body, "owner")) {
      const owner = normalizeText(body.owner, MAX_SCOPE_LENGTH);
      if (normalizeComparable(owner) !== normalizeComparable(scope)) return scopeDenied(scope);
    }
  }

  return null;
}

async function listRedirects(env: Env) {
  const result = await requireD1Database(env)
    .prepare(
      `SELECT old_slug, new_slug, content_id, created_at, updated_at
       FROM content_redirects
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .bind(MAX_REDIRECTS)
    .all<ContentRedirectRow>();
  return result.results ?? [];
}

async function handleRedirects(request: Request, env: Env, segments: string[]) {
  const capability: AdminCapability = request.method === "GET" ? "content.read" : "content.update";
  const authenticated = await authenticateFor(request, env, capability, "content-redirects");
  if (authenticated instanceof Response) return authenticated;

  if (request.method === "GET" && segments.length === 1) {
    return noStore(json({ items: await listRedirects(env), generatedAt: new Date().toISOString() }));
  }

  if (authenticated.role !== "admin") {
    return noStore(jsonError("administrator role is required", 403, { resource: "content-redirects" }));
  }

  if (request.method === "POST" && segments.length === 1) {
    const body = parseJsonRecord(await request.json().catch(() => null));
    const oldSlug = normalizeText(body?.oldSlug, 240);
    const newSlug = normalizeText(body?.newSlug, 240);
    if (
      !oldSlug ||
      !newSlug ||
      oldSlug === newSlug ||
      oldSlug.startsWith("__deleted__:") ||
      newSlug.startsWith("__deleted__:")
    ) {
      return noStore(jsonError("invalid redirect", 400, { resource: "content-redirects" }));
    }

    const db = requireD1Database(env);
    const activeOld = await db
      .prepare("SELECT id FROM contents WHERE slug = ? AND COALESCE(deleted_at, '') = '' LIMIT 1")
      .bind(oldSlug)
      .first<{ id: string }>();
    if (activeOld) return noStore(jsonError("old slug is currently active", 409, { resource: "content-redirects" }));
    const target = await db
      .prepare("SELECT id FROM contents WHERE slug = ? AND COALESCE(deleted_at, '') = '' LIMIT 1")
      .bind(newSlug)
      .first<{ id: string }>();
    if (!target) return noStore(jsonError("redirect target is not active", 404, { resource: "content-redirects" }));

    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO content_redirects (old_slug, new_slug, content_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(old_slug) DO UPDATE SET
           new_slug = excluded.new_slug,
           content_id = excluded.content_id,
           updated_at = excluded.updated_at`
      )
      .bind(oldSlug, newSlug, target.id, now, now)
      .run();
    await writeAudit(env, {
      entityType: "content-redirect",
      entityId: oldSlug,
      action: "upsert",
      actor: authenticated.actor,
      metadata: { oldSlug, newSlug, contentId: target.id }
    });
    return noStore(json({ oldSlug, newSlug, contentId: target.id, updatedAt: now }));
  }

  if (request.method === "DELETE" && segments.length === 2) {
    const oldSlug = decodeURIComponent(segments[1] || "");
    if (!oldSlug) return noStore(jsonError("redirect slug is required", 400, { resource: "content-redirects" }));
    const result = await requireD1Database(env)
      .prepare("DELETE FROM content_redirects WHERE old_slug = ?")
      .bind(oldSlug)
      .run();
    if (!result.meta.changes) return noStore(jsonError("not found", 404, { resource: "content-redirects" }));
    await writeAudit(env, {
      entityType: "content-redirect",
      entityId: oldSlug,
      action: "delete",
      actor: authenticated.actor
    });
    return noStore(json({ oldSlug, deleted: true }));
  }

  return noStore(jsonError("method not allowed", 405, { resource: "content-redirects" }));
}

function incrementCount(target: Map<string, { label: string; count: number }>, value: string) {
  const label = value.trim();
  if (!label) return;
  const key = normalizeComparable(label);
  const current = target.get(key);
  if (current) current.count += 1;
  else target.set(key, { label, count: 1 });
}

async function taxonomySnapshot(env: Env, scope: string) {
  const result = await requireD1Database(env)
    .prepare("SELECT id, owner, category, tags_json FROM contents WHERE COALESCE(deleted_at, '') = ''")
    .all<TaxonomyContentRow>();
  const categories = new Map<string, { label: string; count: number }>();
  const tags = new Map<string, { label: string; count: number }>();
  for (const row of result.results ?? []) {
    if (scope && normalizeComparable(row.owner || "") !== normalizeComparable(scope)) continue;
    splitCategories(row.category || "").forEach((value) => incrementCount(categories, value));
    parseJsonArray(row.tags_json || "[]").forEach((value) => incrementCount(tags, value));
  }
  const sortItems = (map: Map<string, { label: string; count: number }>) =>
    [...map.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "th"));
  return { categories: sortItems(categories), tags: sortItems(tags) };
}

function renameValues(values: string[], from: string, to: string) {
  const fromKey = normalizeComparable(from);
  let changed = false;
  const next = values.flatMap((value) => {
    if (normalizeComparable(value) !== fromKey) return [value];
    changed = true;
    return to ? [to] : [];
  });
  return { changed, values: uniqueCaseInsensitive(next) };
}

async function handleTaxonomy(request: Request, env: Env) {
  const capability: AdminCapability = request.method === "GET" ? "content.read" : "content.update";
  const authenticated = await authenticateFor(request, env, capability, "taxonomy");
  if (authenticated instanceof Response) return authenticated;
  const scope = await getEditorScope(env, authenticated);

  if (request.method === "GET") {
    return noStore(json({ ...(await taxonomySnapshot(env, scope)), generatedAt: new Date().toISOString(), scope }));
  }

  if (request.method !== "PATCH") return noStore(jsonError("method not allowed", 405, { resource: "taxonomy" }));
  const body = parseJsonRecord(await request.json().catch(() => null));
  const kind = body?.kind === "category" || body?.kind === "tag" ? (body.kind as TaxonomyKind) : null;
  const from = normalizeText(body?.from, MAX_TAXONOMY_LENGTH);
  const to = normalizeText(body?.to, MAX_TAXONOMY_LENGTH);
  if (!kind || !from || normalizeComparable(from) === normalizeComparable(to)) {
    return noStore(jsonError("invalid taxonomy change", 400, { resource: "taxonomy" }));
  }

  const db = requireD1Database(env);
  const result = await db
    .prepare("SELECT id, owner, category, tags_json FROM contents WHERE COALESCE(deleted_at, '') = ''")
    .all<TaxonomyContentRow>();
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  let affected = 0;

  for (const row of result.results ?? []) {
    if (scope && normalizeComparable(row.owner || "") !== normalizeComparable(scope)) continue;
    if (kind === "category") {
      const renamed = renameValues(splitCategories(row.category || ""), from, to);
      if (!renamed.changed) continue;
      statements.push(
        db
          .prepare(
            "UPDATE contents SET category = ?, updated_at = ?, updated_by = ?, revision = revision + 1 WHERE id = ?"
          )
          .bind(renamed.values.join(", "), now, authenticated.actor, row.id)
      );
    } else {
      const renamed = renameValues(parseJsonArray(row.tags_json || "[]"), from, to);
      if (!renamed.changed) continue;
      statements.push(
        db
          .prepare(
            "UPDATE contents SET tags_json = ?, updated_at = ?, updated_by = ?, revision = revision + 1 WHERE id = ?"
          )
          .bind(JSON.stringify(renamed.values), now, authenticated.actor, row.id)
      );
    }
    affected += 1;
  }

  for (let offset = 0; offset < statements.length; offset += RECOVERY_BATCH_SIZE) {
    await db.batch(statements.slice(offset, offset + RECOVERY_BATCH_SIZE));
  }
  await writeAudit(env, {
    entityType: "taxonomy",
    entityId: `${kind}:${from}`,
    action: to ? "rename-merge" : "remove",
    actor: authenticated.actor,
    metadata: { kind, from, to, affected, scope }
  });
  return noStore(json({ kind, from, to, affected, ...(await taxonomySnapshot(env, scope)), generatedAt: now, scope }));
}

async function handleScopes(request: Request, env: Env, segments: string[]) {
  const capability: AdminCapability = request.method === "GET" ? "users.read-all" : "users.update-any";
  const authenticated = await authenticateFor(
    request,
    env,
    capability,
    "content-scopes",
    request.method === "GET" ? undefined : "password"
  );
  if (authenticated instanceof Response) return authenticated;
  if (authenticated.role !== "admin")
    return noStore(jsonError("administrator role is required", 403, { resource: "content-scopes" }));
  const db = requireD1Database(env);

  if (request.method === "GET" && segments.length === 1) {
    const result = await db
      .prepare("SELECT id, email, name, role, status, content_scope FROM app_admin_users ORDER BY role, name, email")
      .all<ContentScopeRow>();
    return noStore(
      json({
        items: (result.results ?? []).map((row) => ({
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          status: row.status,
          contentScope: row.content_scope || ""
        })),
        generatedAt: new Date().toISOString()
      })
    );
  }

  if (request.method === "PUT" && segments.length === 2) {
    const userId = decodeURIComponent(segments[1] || "");
    const body = parseJsonRecord(await request.json().catch(() => null));
    const contentScope = normalizeText(body?.contentScope, MAX_SCOPE_LENGTH);
    const target = await db
      .prepare("SELECT id, role FROM app_admin_users WHERE id = ? LIMIT 1")
      .bind(userId)
      .first<{ id: string; role: string }>();
    if (!target) return noStore(jsonError("not found", 404, { resource: "content-scopes" }));
    if (contentScope && target.role !== "editor") {
      return noStore(jsonError("content scopes can only be assigned to editors", 409, { resource: "content-scopes" }));
    }
    await db.prepare("UPDATE app_admin_users SET content_scope = ? WHERE id = ?").bind(contentScope, userId).run();
    await writeAudit(env, {
      entityType: "admin-user",
      entityId: userId,
      action: "content-scope-update",
      actor: authenticated.actor,
      metadata: { contentScope }
    });
    return noStore(json({ id: userId, contentScope }));
  }

  return noStore(jsonError("method not allowed", 405, { resource: "content-scopes" }));
}

function normalizeRecoveryBinding(value: unknown) {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  throw new TypeError("backup row contains a non-scalar value");
}

async function getTableColumns(db: D1Database, table: RecoveryTable) {
  const result = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return new Set((result.results ?? []).map((row) => row.name).filter(Boolean));
}

async function recoverBackup(request: Request, env: Env) {
  const authenticated = await authenticateFor(request, env, "backup.restore", "system-backup-recovery", "mfa");
  if (authenticated instanceof Response) return authenticated;
  if (authenticated.role !== "admin")
    return noStore(jsonError("administrator role is required", 403, { resource: "system-backup-recovery" }));

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_RECOVERY_BYTES)
    return noStore(jsonError("backup payload is too large", 413, { resource: "system-backup-recovery" }));
  const payload = parseJsonRecord(await request.json().catch(() => null));
  const schemaVersion = Number(payload?.schemaVersion);
  const tables = parseJsonRecord(payload?.tables);
  if (![1, 2].includes(schemaVersion) || !tables) {
    return noStore(jsonError("unsupported backup schema", 400, { resource: "system-backup-recovery" }));
  }

  const db = requireD1Database(env);
  const prepared: D1PreparedStatement[] = [];
  const restoredCounts: Record<string, number> = {};

  try {
    for (const table of RECOVERY_TABLES) {
      const tablePayload = parseJsonRecord(tables[table]);
      const rows = Array.isArray(tablePayload?.rows) ? tablePayload.rows : [];
      if (!rows.length) {
        restoredCounts[table] = 0;
        continue;
      }
      const availableColumns = await getTableColumns(db, table);
      if (!availableColumns.size) {
        restoredCounts[table] = 0;
        continue;
      }
      let accepted = 0;
      for (const rawRow of rows) {
        const row = parseJsonRecord(rawRow);
        if (!row) throw new TypeError(`${table}: backup row is invalid`);
        const columns = Object.keys(row).filter((column) => availableColumns.has(column));
        if (!columns.length) continue;
        const values = columns.map((column) => normalizeRecoveryBinding(row[column]));
        const placeholders = columns.map(() => "?").join(", ");
        prepared.push(
          db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`).bind(...values)
        );
        accepted += 1;
      }
      restoredCounts[table] = accepted;
    }
  } catch (error) {
    return noStore(
      jsonError("backup validation failed", 400, {
        resource: "system-backup-recovery",
        detail: error instanceof Error ? error.message : "invalid backup row"
      })
    );
  }

  for (let offset = 0; offset < prepared.length; offset += RECOVERY_BATCH_SIZE) {
    await db.batch(prepared.slice(offset, offset + RECOVERY_BATCH_SIZE));
  }
  await db
    .prepare(
      `DELETE FROM content_redirects
       WHERE old_slug IN (SELECT slug FROM contents WHERE COALESCE(deleted_at, '') = '')
          OR new_slug NOT IN (SELECT slug FROM contents WHERE COALESCE(deleted_at, '') = '')`
    )
    .run();

  const restoredRows = Object.values(restoredCounts).reduce((sum, count) => sum + count, 0);
  await writeAudit(env, {
    entityType: "system-backup",
    entityId: `recovery-${crypto.randomUUID()}`,
    action: "merge-recovery",
    actor: authenticated.actor,
    metadata: { schemaVersion, restoredRows, restoredCounts }
  });
  return noStore(
    json({ schemaVersion, mode: "merge", restoredRows, restoredCounts, completedAt: new Date().toISOString() })
  );
}

export async function handleAdminCmsGapClosure(request: Request, env: Env): Promise<Response | null> {
  if (!env.DB) return null;
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(ADMIN_PREFIX)) return null;
  const segments = pathname.slice(ADMIN_PREFIX.length).split("/");

  if (segments[0] === "content-redirects") return handleRedirects(request, env, segments);
  if (segments[0] === "taxonomy" && segments.length === 1) return handleTaxonomy(request, env);
  if (segments[0] === "content-scopes") return handleScopes(request, env, segments);
  if (segments[0] === "backup" && segments[1] === "recover" && request.method === "POST")
    return recoverBackup(request, env);
  return null;
}
