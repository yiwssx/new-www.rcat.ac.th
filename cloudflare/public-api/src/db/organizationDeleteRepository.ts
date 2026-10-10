import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";

export type OrganizationDeletable = "personnel" | "position" | "assignment";
const TABLE = {
  personnel: "personnel",
  position: "organization_positions",
  assignment: "organization_assignments"
} as const;

/**
 * No cascades: D1 foreign keys reject deletion of personnel or positions
 * referenced by assignments. Assignments are removable individually, with
 * a revision-specific audit event. The batch rolls back if constraints fail.
 */
export async function deleteAuditedOrganizationEntity(
  env: Env,
  kind: OrganizationDeletable,
  id: string,
  expectedRevision: number,
  actor: string,
  now: string
) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new RangeError("invalid expected revision");
  }
  const db = requireD1Database(env);
  const table = TABLE[kind];
  const audit = db
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       SELECT ?, ?, ?, 'delete', ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND revision = ?)`
    )
    .bind(
      `audit-${crypto.randomUUID()}`,
      kind,
      id,
      actor,
      now,
      JSON.stringify({ expectedRevision }),
      id,
      expectedRevision
    );
  const deletion = db
    .prepare(`DELETE FROM ${table} WHERE id = ? AND revision = ?`)
    .bind(id, expectedRevision);
  const results = await db.batch([audit, deletion]);
  return Number(results[1]?.meta.changes ?? 0) === 1;
}
