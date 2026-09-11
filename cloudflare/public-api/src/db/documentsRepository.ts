import { logD1QueryMetrics } from "../d1QueryMetrics";
import type { Env } from "../env";
import { DOCUMENT_ROW_COLUMNS, type DocumentRow } from "./schema";

export function requireD1Database(env: Env) {
  if (!env.DB) {
    throw new Error("D1 DB binding is required for public documents repository access");
  }

  return env.DB;
}

export async function listPublishedDocumentRows(env: Env): Promise<DocumentRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      `SELECT ${DOCUMENT_ROW_COLUMNS.join(", ")}
       FROM documents
       WHERE status = ?
         AND deleted_at = ''
       ORDER BY pinned DESC, sort_order ASC, published_at DESC, updated_at DESC`
    )
    .bind("published")
    .all<DocumentRow>();

  logD1QueryMetrics(env, "public.documents.all", result);
  return result.results ?? [];
}

export async function listHomePublishedDocumentRows(env: Env, limit = 3): Promise<DocumentRow[]> {
  const normalizedLimit = Math.min(12, Math.max(1, Math.floor(limit)));
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${DOCUMENT_ROW_COLUMNS.join(", ")}
       FROM documents
       WHERE status = ?
         AND deleted_at = ''
       ORDER BY pinned DESC, sort_order ASC, published_at DESC, updated_at DESC
       LIMIT ?`
    )
    .bind("published", normalizedLimit)
    .all<DocumentRow>();

  logD1QueryMetrics(env, "public.home.documents", result);
  return result.results ?? [];
}
