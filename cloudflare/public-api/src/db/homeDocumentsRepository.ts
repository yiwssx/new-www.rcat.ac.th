import type { Env } from "../env";
import { logD1QueryUsage } from "./d1QueryUsage";
import { requireD1Database } from "./documentsRepository";
import { DOCUMENT_ROW_COLUMNS, type DocumentRow } from "./schema";

const HOME_DOCUMENT_LIMIT = 3;

export async function listHomePublishedDocumentRows(env: Env): Promise<DocumentRow[]> {
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${DOCUMENT_ROW_COLUMNS.join(", ")}
       FROM documents
       WHERE status = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY pinned DESC, sort_order ASC, published_at DESC, updated_at DESC
       LIMIT ?`
    )
    .bind("published", HOME_DOCUMENT_LIMIT)
    .all<DocumentRow>();

  logD1QueryUsage(env, "home:documents", result);
  return (result.results ?? []).slice(0, HOME_DOCUMENT_LIMIT);
}
