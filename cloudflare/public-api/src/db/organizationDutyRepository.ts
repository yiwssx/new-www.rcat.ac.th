import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  ORGANIZATION_ASSIGNMENT_ROW_COLUMNS,
  ORGANIZATION_POSITION_ROW_COLUMNS,
  type OrganizationAssignmentRow,
  type OrganizationPositionRow
} from "./organizationSchema";

type DutyKind = "position" | "assignment";

const TABLE = {
  position: {
    table: "organization_positions",
    columns: ORGANIZATION_POSITION_ROW_COLUMNS
  },
  assignment: {
    table: "organization_assignments",
    columns: ORGANIZATION_ASSIGNMENT_ROW_COLUMNS
  }
} as const;

function assertRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("invalid organization revision");
}

function auditStatement(
  database: D1Database,
  entity: DutyKind,
  id: string,
  action: "create" | "update",
  actor: string,
  now: string,
  metadata: Record<string, unknown>,
  revision?: number
) {
  if (revision === undefined) {
    return database
      .prepare(
        `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(`audit-${crypto.randomUUID()}`, entity, id, action, actor, now, JSON.stringify(metadata));
  }
  return database
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM ${TABLE[entity].table} WHERE id = ? AND revision = ?)`
    )
    .bind(
      `audit-${crypto.randomUUID()}`,
      entity,
      id,
      action,
      actor,
      now,
      JSON.stringify(metadata),
      id,
      revision
    );
}

async function createAuditedRow(
  env: Env,
  entity: DutyKind,
  row: OrganizationPositionRow | OrganizationAssignmentRow,
  actor: string
) {
  const database = requireD1Database(env);
  const model = TABLE[entity];
  const values = row as unknown as Record<string, unknown>;
  const columns: readonly string[] = model.columns;
  const insert = database
    .prepare(
      `INSERT INTO ${model.table} (${columns.join(", ")})
       VALUES (${columns.map(() => "?").join(", ")})`
    )
    .bind(...columns.map((column) => (column === "revision" ? 0 : values[column])));
  const audit = auditStatement(database, entity, row.id, "create", actor, row.created_at, {});
  await database.batch([insert, audit]);
}

async function updateAuditedRow(
  env: Env,
  entity: DutyKind,
  row: OrganizationPositionRow | OrganizationAssignmentRow,
  revision: number,
  actor: string,
  changedFields: readonly string[]
) {
  assertRevision(revision);
  const database = requireD1Database(env);
  const model = TABLE[entity];
  const columns: readonly string[] = model.columns;
  const values = row as unknown as Record<string, unknown>;
  const mutableColumns = columns.filter((column) => !["id", "revision", "created_at"].includes(column));
  const audit = auditStatement(
    database,
    entity,
    row.id,
    "update",
    actor,
    row.updated_at,
    { changedFields, expectedRevision: revision },
    revision
  );
  const update = database
    .prepare(
      `UPDATE ${model.table}
       SET ${mutableColumns.map((column) => `${column} = ?`).join(", ")}, revision = revision + 1
       WHERE id = ? AND revision = ?`
    )
    .bind(...mutableColumns.map((column) => values[column]), row.id, revision);
  const result = await database.batch([audit, update]);
  return Number(result[1]?.meta.changes ?? 0) === 1;
}

export async function createAuditedOrganizationPosition(env: Env, row: OrganizationPositionRow, actor: string) {
  return createAuditedRow(env, "position", row, actor);
}

export async function updateAuditedOrganizationPosition(
  env: Env,
  row: OrganizationPositionRow,
  revision: number,
  actor: string,
  changedFields: readonly string[]
) {
  return updateAuditedRow(env, "position", row, revision, actor, changedFields);
}

export async function createAuditedOrganizationAssignment(env: Env, row: OrganizationAssignmentRow, actor: string) {
  return createAuditedRow(env, "assignment", row, actor);
}

export async function updateAuditedOrganizationAssignment(
  env: Env,
  row: OrganizationAssignmentRow,
  revision: number,
  actor: string,
  changedFields: readonly string[]
) {
  return updateAuditedRow(env, "assignment", row, revision, actor, changedFields);
}

export function getAdminOrganizationPositionById(env: Env, id: string) {
  return requireD1Database(env)
    .prepare(`SELECT ${ORGANIZATION_POSITION_ROW_COLUMNS.join(", ")} FROM organization_positions WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<OrganizationPositionRow>();
}

export function getAdminOrganizationAssignmentById(env: Env, id: string) {
  return requireD1Database(env)
    .prepare(`SELECT ${ORGANIZATION_ASSIGNMENT_ROW_COLUMNS.join(", ")} FROM organization_assignments WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<OrganizationAssignmentRow>();
}
