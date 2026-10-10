import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  ORGANIZATION_ASSIGNMENT_ROW_COLUMNS,
  ORGANIZATION_POSITION_ROW_COLUMNS,
  ORGANIZATION_UNIT_ROW_COLUMNS,
  PERSONNEL_ROW_COLUMNS,
  type OrganizationAssignmentRow,
  type OrganizationPositionRow,
  type OrganizationUnitRow,
  type PersonnelRow
} from "./organizationSchema";

/**
 * Internal persistence seam, not a public HTTP API. Callers must authenticate,
 * authorize, validate field values, generate IDs and record audit events.
 * ASVS 1.2.4: all table/column identifiers are hard-coded in this module and
 * every mutable value is passed via D1 bind parameters.
 */
const MODELS = {
  unit: {
    table: "organization_units",
    key: "content_id",
    columns: ORGANIZATION_UNIT_ROW_COLUMNS,
    order: "sort_order ASC, content_id ASC"
  },
  person: {
    table: "personnel",
    key: "id",
    columns: PERSONNEL_ROW_COLUMNS,
    order: "display_name COLLATE NOCASE ASC, id ASC"
  },
  position: {
    table: "organization_positions",
    key: "id",
    columns: ORGANIZATION_POSITION_ROW_COLUMNS,
    order: "group_sort_order ASC, sort_order ASC, id ASC"
  },
  assignment: {
    table: "organization_assignments",
    key: "id",
    columns: ORGANIZATION_ASSIGNMENT_ROW_COLUMNS,
    order: "sort_order ASC, id ASC"
  }
} as const;

export type OrganizationTableKind = keyof typeof MODELS;
export type OrganizationWritableRow =
  OrganizationUnitRow | PersonnelRow | OrganizationPositionRow | OrganizationAssignmentRow;

function toRecord(row: OrganizationWritableRow): Record<string, unknown> {
  return row as unknown as Record<string, unknown>;
}

function validateExpectedRevision(expectedRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new RangeError("expected revision must be a nonnegative safe integer");
  }
}

/** Server-generated initial revisions always begin at zero. */
async function insertRow(env: Env, kind: OrganizationTableKind, row: OrganizationWritableRow) {
  const model = MODELS[kind];
  const columns: readonly string[] = model.columns;
  const values = toRecord(row);

  return requireD1Database(env)
    .prepare(
      `INSERT INTO ${model.table} (${columns.join(", ")})
       VALUES (${columns.map(() => "?").join(", ")})`
    )
    .bind(...columns.map((column) => (column === "revision" ? 0 : values[column])))
    .run();
}

/**
 * Compare-and-swap at D1, not in a prior JavaScript read. Unaffected rows mean
 * stale revision or missing item. No nullable/unconditional bypass.
 */
async function updateRow(
  env: Env,
  kind: OrganizationTableKind,
  row: OrganizationWritableRow,
  expectedRevision: number
) {
  validateExpectedRevision(expectedRevision);
  const model = MODELS[kind];
  const columns: readonly string[] = model.columns;
  const mutableColumns = columns.filter((column) => ![model.key, "created_at", "revision"].includes(column));
  const values = toRecord(row);

  const result = await requireD1Database(env)
    .prepare(
      `UPDATE ${model.table}
       SET ${mutableColumns.map((column) => `${column} = ?`).join(", ")},
           revision = revision + 1
       WHERE ${model.key} = ? AND revision = ?`
    )
    .bind(...mutableColumns.map((column) => values[column]), values[model.key], expectedRevision)
    .run();

  return result.meta.changes === 1;
}

/** Bounded internal dataset until the Phase 3 Admin route exposes pagination. */
async function listRows<T>(env: Env, kind: OrganizationTableKind, limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new RangeError("organization page size must be between 1 and 500");
  }
  const model = MODELS[kind];

  const result = await requireD1Database(env)
    .prepare(`SELECT ${model.columns.join(", ")} FROM ${model.table} ORDER BY ${model.order} LIMIT ?`)
    .bind(limit)
    .all<T>();

  return result.results ?? [];
}

export function listAdminOrganizationUnits(env: Env, limit?: number) {
  return listRows<OrganizationUnitRow>(env, "unit", limit);
}

export function listAdminPersonnel(env: Env, limit?: number) {
  return listRows<PersonnelRow>(env, "person", limit);
}

export function listAdminOrganizationPositions(env: Env, limit?: number) {
  return listRows<OrganizationPositionRow>(env, "position", limit);
}

export function listAdminOrganizationAssignments(env: Env, limit?: number) {
  return listRows<OrganizationAssignmentRow>(env, "assignment", limit);
}

export function createOrganizationUnitRow(env: Env, row: OrganizationUnitRow) {
  return insertRow(env, "unit", row);
}

export function updateOrganizationUnitRow(env: Env, row: OrganizationUnitRow, expectedRevision: number) {
  return updateRow(env, "unit", row, expectedRevision);
}

export function createPersonnelRow(env: Env, row: PersonnelRow) {
  return insertRow(env, "person", row);
}

export function updatePersonnelRow(env: Env, row: PersonnelRow, expectedRevision: number) {
  return updateRow(env, "person", row, expectedRevision);
}

export function createOrganizationPositionRow(env: Env, row: OrganizationPositionRow) {
  return insertRow(env, "position", row);
}

export function updateOrganizationPositionRow(env: Env, row: OrganizationPositionRow, expectedRevision: number) {
  return updateRow(env, "position", row, expectedRevision);
}

export function createOrganizationAssignmentRow(env: Env, row: OrganizationAssignmentRow) {
  return insertRow(env, "assignment", row);
}

export function updateOrganizationAssignmentRow(env: Env, row: OrganizationAssignmentRow, expectedRevision: number) {
  return updateRow(env, "assignment", row, expectedRevision);
}

/** The audit insert and personnel creation run as a single D1 transaction. */
export async function createAuditedPersonnelRow(env: Env, row: PersonnelRow, actor: string) {
  const db = requireD1Database(env);
  const insert = db
    .prepare(
      `INSERT INTO personnel (${PERSONNEL_ROW_COLUMNS.join(", ")})
       VALUES (${PERSONNEL_ROW_COLUMNS.map(() => "?").join(", ")})`
    )
    .bind(...PERSONNEL_ROW_COLUMNS.map((column) => (column === "revision" ? 0 : row[column])));
  const audit = db
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       VALUES (?, 'personnel', ?, 'create', ?, ?, '{}')`
    )
    .bind(`audit-${crypto.randomUUID()}`, row.id, actor, row.created_at);
  await db.batch([insert, audit]);
}

/**
 * Audit is gated on the expected revision inside the same D1 transaction.
 * A stale write neither alters personnel nor inserts a misleading audit event.
 * No private contact values are stored in the audit metadata.
 */
export async function updateAuditedPersonnelRow(
  env: Env,
  row: PersonnelRow,
  expectedRevision: number,
  actor: string,
  changedFields: readonly string[]
): Promise<boolean> {
  validateExpectedRevision(expectedRevision);
  const db = requireD1Database(env);
  const audit = db
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       SELECT ?, 'personnel', ?, 'update', ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM personnel WHERE id = ? AND revision = ?)`
    )
    .bind(
      `audit-${crypto.randomUUID()}`,
      row.id,
      actor,
      row.updated_at,
      JSON.stringify({ changedFields, expectedRevision }),
      row.id,
      expectedRevision
    );
  const update = db
    .prepare(
      `UPDATE personnel
       SET display_name = ?, personnel_type = ?, employment_position = ?, photo_media_id = ?,
           public_email = ?, public_phone = ?, show_public_email = ?, show_public_phone = ?,
           active = ?, updated_at = ?, revision = revision + 1
       WHERE id = ? AND revision = ?`
    )
    .bind(
      row.display_name,
      row.personnel_type,
      row.employment_position,
      row.photo_media_id,
      row.public_email,
      row.public_phone,
      row.show_public_email,
      row.show_public_phone,
      row.active,
      row.updated_at,
      row.id,
      expectedRevision
    );
  const results = await db.batch([audit, update]);
  return Number(results[1]?.meta.changes ?? 0) === 1;
}

export function getAdminPersonnelById(env: Env, id: string) {
  return requireD1Database(env)
    .prepare(`SELECT ${PERSONNEL_ROW_COLUMNS.join(", ")} FROM personnel WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<PersonnelRow>();
}
