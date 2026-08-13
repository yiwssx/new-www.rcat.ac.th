import { requireD1Database } from "../db/documentsRepository";
import type { Env } from "../env";
import { json, jsonError, methodNotAllowed } from "../responses";

const BACKUP_TABLES = [
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
  "visitor_daily_stats"
] as const;

const encoder = new TextEncoder();

type BackupEnvironment = "preview" | "production" | "unknown";
type BackupTableName = (typeof BACKUP_TABLES)[number];
type BackupTableStatus = "ok" | "missing" | "error";
type JsonRecord = Record<string, unknown>;

interface BackupTableCount {
  name: BackupTableName;
  rowCount: number;
  status: BackupTableStatus;
  message?: string;
}

interface BackupReadResult {
  rowCount: number;
  rows: JsonRecord[];
  status: BackupTableStatus;
  warning?: string;
  message?: string;
}

function normalizeEnvironment(value: string | undefined): BackupEnvironment {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "preview" || normalized === "production") {
    return normalized;
  }

  return "unknown";
}

function getCountValue(row: JsonRecord | null | undefined) {
  if (!row) {
    return 0;
  }

  const value = row.rowCount ?? row.count ?? Object.values(row)[0];
  const count = Number(value);

  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function isMissingTableError(error: unknown) {
  return error instanceof Error && /no such table/i.test(error.message);
}

function getTableWarning(table: BackupTableName, status: Exclude<BackupTableStatus, "ok">) {
  const message =
    status === "missing" ? "table is not present in this environment" : "table could not be read in this environment";

  return {
    message,
    warning: `${table}: ${message}`
  };
}

async function readTableCount(db: D1Database, table: BackupTableName): Promise<BackupTableCount> {
  try {
    const row = await db.prepare(`SELECT COUNT(*) AS rowCount FROM ${table}`).first<JsonRecord>();

    return {
      name: table,
      rowCount: getCountValue(row),
      status: "ok"
    };
  } catch (error) {
    const status = isMissingTableError(error) ? "missing" : "error";
    const { message } = getTableWarning(table, status);

    return {
      name: table,
      rowCount: 0,
      status,
      message
    };
  }
}

async function readTableRows(db: D1Database, table: BackupTableName): Promise<BackupReadResult> {
  try {
    const result = await db.prepare(`SELECT * FROM ${table}`).all<JsonRecord>();
    const rows = result.results ?? [];

    return {
      rowCount: rows.length,
      rows,
      status: "ok"
    };
  } catch (error) {
    const status = isMissingTableError(error) ? "missing" : "error";
    const { message, warning } = getTableWarning(table, status);

    return {
      rowCount: 0,
      rows: [],
      status,
      warning,
      message
    };
  }
}

function noStoreHeaders(extraHeaders: HeadersInit = {}) {
  return {
    "Cache-Control": "no-store",
    ...extraHeaders
  };
}

function backupMethodNotAllowed() {
  const response = methodNotAllowed();
  response.headers.set("Allow", "GET, OPTIONS");
  return response;
}

function enqueueJson(controller: ReadableStreamDefaultController<Uint8Array>, value: unknown) {
  controller.enqueue(encoder.encode(JSON.stringify(value)));
}

function createBackupDownloadStream(db: D1Database, generatedAt: string, environment: BackupEnvironment) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const counts: Record<string, number> = {};
      const warnings: string[] = [];

      try {
        controller.enqueue(
          encoder.encode(
            `{"schemaVersion":1,"generatedAt":${JSON.stringify(generatedAt)},"environment":${JSON.stringify(
              environment
            )},"source":{"app":"new-www.rcat.ac.th","backend":"cloudflare-d1"},"tables":{`
          )
        );

        for (const [index, table] of BACKUP_TABLES.entries()) {
          const result = await readTableRows(db, table);
          counts[table] = result.rowCount;

          if (result.warning) {
            warnings.push(result.warning);
          }

          if (index > 0) {
            controller.enqueue(encoder.encode(","));
          }

          controller.enqueue(encoder.encode(`${JSON.stringify(table)}:`));
          enqueueJson(controller, {
            rowCount: result.rowCount,
            rows: result.rows
          });
        }

        controller.enqueue(encoder.encode(`},"counts":`));
        enqueueJson(controller, counts);

        if (warnings.length > 0) {
          controller.enqueue(encoder.encode(`,"warnings":`));
          enqueueJson(controller, warnings);
        }

        controller.enqueue(encoder.encode("}"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

async function handleCounts(env: Env) {
  const db = requireD1Database(env);
  const tables = await Promise.all(BACKUP_TABLES.map((table) => readTableCount(db, table)));

  return json(
    {
      generatedAt: new Date().toISOString(),
      environment: normalizeEnvironment(env.ENVIRONMENT),
      tables,
      counts: Object.fromEntries(tables.map((table) => [table.name, table.rowCount])),
      warnings: tables
        .filter((table) => table.status !== "ok")
        .map((table) => `${table.name}: ${table.message ?? "table could not be read"}`)
    },
    {
      headers: noStoreHeaders()
    }
  );
}

function handleDownload(env: Env) {
  const db = requireD1Database(env);
  const generatedAt = new Date().toISOString();
  const environment = normalizeEnvironment(env.ENVIRONMENT);
  const timestamp = generatedAt.replace(/[:.]/g, "-");

  return new Response(createBackupDownloadStream(db, generatedAt, environment), {
    headers: noStoreHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="rcat-d1-backup-${environment}-${timestamp}.json"`
    })
  });
}

export async function handleAdminBackup(request: Request, env: Env, segments: string[]) {
  if (segments[0] !== "backup") {
    return null;
  }

  if (request.method !== "GET") {
    return backupMethodNotAllowed();
  }

  if (segments.length === 2 && segments[1] === "counts") {
    return handleCounts(env);
  }

  if (segments.length === 2 && segments[1] === "download") {
    return handleDownload(env);
  }

  return jsonError("not found", 404, {
    resource: "system-backup"
  });
}
