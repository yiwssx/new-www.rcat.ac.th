import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";

/**
 * Move one existing personnel assignment across positions / units and append in
 * the destination inside a single serialized D1 batch. No personnel row is changed.
 *
 * The same guard protects the UPDATE and audit INSERT. A stale source or a
 * duplicate active person in the target means zero writes and zero audit rows.
 * FK/capacity/limit triggers abort the entire batch.
 */
export async function moveAuditedOrganizationAssignment(
  env: Env,
  input: {
    id: string;
    expectedRevision: number;
    expectedSourcePositionId: string;
    destinationPositionId: string;
    personnelId: string;
  },
  actor: string
): Promise<boolean> {
  const { id, expectedRevision, expectedSourcePositionId, destinationPositionId, personnelId } = input;
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    destinationPositionId === expectedSourcePositionId
  ) {
    return false;
  }
  const db = requireD1Database(env);
  const now = new Date().toISOString();
  const guard = `EXISTS (
    SELECT 1 FROM organization_assignments AS source
    WHERE source.id = ?1 AND source.revision = ?2
      AND source.position_id = ?3 AND source.personnel_id = ?4
      AND NOT EXISTS (
        SELECT 1 FROM organization_assignments AS duplicate
        WHERE duplicate.position_id = ?5 AND duplicate.personnel_id = ?4
          AND duplicate.enabled = 1 AND duplicate.id <> ?1
      )
  )`;
  const args = [id, expectedRevision, expectedSourcePositionId, personnelId, destinationPositionId];
  const audit = db
    .prepare(
      `INSERT INTO admin_audit_log
         (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       SELECT ?6, 'assignment', ?1, 'update', ?7, ?8, ?9
       WHERE ${guard}`
    )
    .bind(
      ...args,
      `audit-${crypto.randomUUID()}`,
      actor,
      now,
      JSON.stringify({
        operation: "transfer",
        fromPositionId: expectedSourcePositionId,
        toPositionId: destinationPositionId,
        expectedRevision
      })
    );
  const update = db
    .prepare(
      `UPDATE organization_assignments
       SET position_id = ?5,
           sort_order = (
             SELECT COALESCE(MAX(item.sort_order) + 1, 0)
             FROM organization_assignments AS item
             WHERE item.position_id = ?5
           ),
           updated_at = ?6,
           revision = revision + 1
       WHERE id = ?1 AND ${guard}`
    )
    .bind(...args, now);
  const result = await db.batch([audit, update]);
  return Number(result[1]?.meta.changes ?? 0) === 1;
}
