import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { DOCUMENT_ADMIN_ROW_COLUMNS, type DocumentRow } from "./schema";

export async function listAdminDocumentRows(env: Env): Promise<DocumentRow[]> {
  const result = await requireD1Database(env)
    .prepare(
      `SELECT ${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")}
       FROM documents
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY pinned DESC, sort_order ASC, published_at DESC, updated_at DESC`
    )
    .all<DocumentRow>();

  return result.results ?? [];
}

export async function getDocumentById(env: Env, id: string): Promise<DocumentRow | null> {
  return requireD1Database(env)
    .prepare(
      `SELECT ${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")}
       FROM documents
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
       LIMIT 1`
    )
    .bind(id)
    .first<DocumentRow>();
}

export async function getDocumentByIdAny(env: Env, id: string): Promise<DocumentRow | null> {
  return requireD1Database(env)
    .prepare(
      `SELECT ${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")}
       FROM documents
       WHERE id = ?
       LIMIT 1`
    )
    .bind(id)
    .first<DocumentRow>();
}

export async function insertDocumentRow(env: Env, row: DocumentRow) {
  await requireD1Database(env)
    .prepare(
      `INSERT INTO documents (${DOCUMENT_ADMIN_ROW_COLUMNS.join(", ")})
       VALUES (${DOCUMENT_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")})`
    )
    .bind(...DOCUMENT_ADMIN_ROW_COLUMNS.map((column) => row[column]))
    .run();
}

export async function updateDocumentRow(env: Env, row: DocumentRow, expectedRevision: number | null) {
  return requireD1Database(env)
    .prepare(
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
         AND (? IS NULL OR revision = ?)`
    )
    .bind(
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
    )
    .run();
}

export async function softDeleteDocumentRow(
  env: Env,
  id: string,
  actor: string,
  now: string,
  expectedRevision: number | null
) {
  return requireD1Database(env)
    .prepare(
      `UPDATE documents
       SET deleted_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
         AND (? IS NULL OR revision = ?)`
    )
    .bind(now, now, actor, id, expectedRevision, expectedRevision)
    .run();
}

export async function updateDocumentPublicationRow(
  env: Env,
  id: string,
  status: "published" | "draft",
  publishedAt: string,
  actor: string,
  now: string,
  expectedRevision: number | null
) {
  return requireD1Database(env)
    .prepare(
      `UPDATE documents
       SET status = ?, published_at = ?, updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ?
         AND COALESCE(deleted_at, '') = ''
         AND (? IS NULL OR revision = ?)`
    )
    .bind(status, publishedAt, now, actor, id, expectedRevision, expectedRevision)
    .run();
}
