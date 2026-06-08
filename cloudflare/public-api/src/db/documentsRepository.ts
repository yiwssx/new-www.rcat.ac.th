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
       ORDER BY pinned DESC, sort_order ASC, published_at DESC`
    )
    .bind("published")
    .all<DocumentRow>();

  return result.results ?? [];
}
