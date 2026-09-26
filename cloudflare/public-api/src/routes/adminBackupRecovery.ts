import { authenticateAdminRequest, type AdminIdentity } from "../auth/adminAccess";
import { requireAdminCapability } from "../auth/adminCapabilities";
import { hasRecentAdminAssurance } from "../auth/adminStepUp";
import { requireD1Database } from "../db/documentsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import {
  SecurityRateLimitExceeded,
  SecurityRateLimitUnavailable,
  enforceSecurityRateLimit
} from "../securityRateLimit";

const RECOVERY_PATH = "/api/admin/backup/recover";
const MAX_RECOVERY_BYTES = 4 * 1024 * 1024;
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
type RecoveryTable = (typeof RECOVERY_TABLES)[number];

interface TableColumnInfo {
  name: string;
  pk: number;
}

interface RecoveryTableSchema {
  columns: Set<string>;
  primaryKey: string[];
}

function noStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function parseJsonRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function normalizeRecoveryBinding(value: unknown) {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  throw new TypeError("backup row contains a non-scalar value");
}

function quoteIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new TypeError(`invalid database identifier: ${value}`);
  }
  return `"${value}"`;
}

export function buildRecoveryUpsertSql(table: string, columns: string[], primaryKey: string[]) {
  if (!columns.length || !primaryKey.length || primaryKey.some((column) => !columns.includes(column))) {
    throw new TypeError("backup row does not contain the table primary key");
  }

  const quotedTable = quoteIdentifier(table);
  const quotedColumns = columns.map(quoteIdentifier);
  const placeholders = columns.map(() => "?").join(", ");
  const conflictTarget = primaryKey.map(quoteIdentifier).join(", ");
  const updateColumns = columns.filter((column) => !primaryKey.includes(column));
  const conflictAction = updateColumns.length
    ? `DO UPDATE SET ${updateColumns
        .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
        .join(", ")}`
    : "DO NOTHING";

  return `INSERT INTO ${quotedTable} (${quotedColumns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) ${conflictAction}`;
}

async function authenticateRecoveryRequest(request: Request, env: Env): Promise<AdminIdentity | Response> {
  const auth = await authenticateAdminRequest(request, env);
  if (auth.response || !auth.identity) return auth.response ?? jsonError("admin authentication failed", 403);

  const denied = requireAdminCapability(auth.identity, "backup.restore", { resource: "system-backup-recovery" });
  if (denied) return denied;
  if (auth.identity.role !== "admin") {
    return noStore(jsonError("administrator role is required", 403, { resource: "system-backup-recovery" }));
  }

  try {
    await enforceSecurityRateLimit(request, env, "admin-api");
  } catch (error) {
    if (error instanceof SecurityRateLimitExceeded) {
      const response = jsonError("too many admin requests", 429, { resource: "system-backup-recovery" });
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return noStore(response);
    }
    if (error instanceof SecurityRateLimitUnavailable) {
      return noStore(jsonError("admin security service is unavailable", 503, { resource: "system-backup-recovery" }));
    }
    throw error;
  }

  if (!hasRecentAdminAssurance(auth.identity, "mfa")) {
    return noStore(
      jsonError("reauthentication required", 428, {
        resource: "system-backup-recovery",
        assurance: "mfa"
      })
    );
  }

  return auth.identity;
}

async function readRecoveryPayload(request: Request) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RECOVERY_BYTES) {
    throw new RangeError("backup payload is too large");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RECOVERY_BYTES) {
    throw new RangeError("backup payload is too large");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SyntaxError("backup payload is not valid JSON");
  }
}

async function readTableSchema(db: D1Database, table: RecoveryTable): Promise<RecoveryTableSchema> {
  const result = await db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all<TableColumnInfo>();
  const rows = result.results ?? [];
  const primaryKey = rows
    .filter((row) => Number(row.pk) > 0)
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map((row) => row.name);

  return {
    columns: new Set(rows.map((row) => row.name).filter(Boolean)),
    primaryKey
  };
}

async function writeRecoveryAudit(
  env: Env,
  identity: AdminIdentity,
  input: { schemaVersion: number; restoredRows: number; restoredCounts: Record<string, number> }
) {
  await requireD1Database(env)
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       VALUES (?, 'system-backup', ?, 'merge-recovery', ?, ?, ?)`
    )
    .bind(
      `audit-${crypto.randomUUID()}`,
      `recovery-${crypto.randomUUID()}`,
      identity.actor,
      new Date().toISOString(),
      JSON.stringify(input)
    )
    .run();
}

async function recoverBackup(request: Request, env: Env, identity: AdminIdentity) {
  let rawPayload: unknown;
  try {
    rawPayload = await readRecoveryPayload(request);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    return noStore(
      jsonError(error instanceof Error ? error.message : "backup payload is invalid", status, {
        resource: "system-backup-recovery"
      })
    );
  }

  const payload = parseJsonRecord(rawPayload);
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

      const schema = await readTableSchema(db, table);
      if (!schema.columns.size) {
        restoredCounts[table] = 0;
        continue;
      }
      if (!schema.primaryKey.length) {
        throw new TypeError(`${table}: table has no stable primary key`);
      }

      let accepted = 0;
      for (const rawRow of rows) {
        const row = parseJsonRecord(rawRow);
        if (!row) throw new TypeError(`${table}: backup row is invalid`);

        const columns = Object.keys(row).filter((column) => schema.columns.has(column));
        if (!columns.length) continue;
        const missingPrimaryKey = schema.primaryKey.find((column) => !columns.includes(column));
        if (missingPrimaryKey) {
          throw new TypeError(`${table}: backup row is missing primary key column ${missingPrimaryKey}`);
        }

        const values = columns.map((column) => normalizeRecoveryBinding(row[column]));
        prepared.push(db.prepare(buildRecoveryUpsertSql(table, columns, schema.primaryKey)).bind(...values));
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

  try {
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
  } catch (error) {
    return noStore(
      jsonError("backup recovery conflict", 409, {
        resource: "system-backup-recovery",
        detail: error instanceof Error ? error.message : "database constraint rejected recovery"
      })
    );
  }

  const restoredRows = Object.values(restoredCounts).reduce((sum, count) => sum + count, 0);
  await writeRecoveryAudit(env, identity, { schemaVersion, restoredRows, restoredCounts });

  return noStore(
    json({ schemaVersion, mode: "merge", restoredRows, restoredCounts, completedAt: new Date().toISOString() })
  );
}

export async function handleAdminBackupRecovery(request: Request, env: Env): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (pathname !== RECOVERY_PATH) return null;
  if (request.method !== "POST") return noStore(jsonError("method not allowed", 405, { resource: "system-backup-recovery" }));
  if (!env.DB) return noStore(jsonError("database binding is not configured", 503, { resource: "system-backup-recovery" }));

  const authenticated = await authenticateRecoveryRequest(request, env);
  if (authenticated instanceof Response) return authenticated;
  return recoverBackup(request, env, authenticated);
}
