import type { ContentRow } from "./schema";
import { CONTENT_ADMIN_ROW_COLUMNS } from "./schema";
import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import type { OrganizationUnitRow } from "./organizationSchema";
import { ORGANIZATION_UNIT_ROW_COLUMNS } from "./organizationSchema";

export interface OrganizationUnitEditorRow {
  unit: OrganizationUnitRow;
  content: ContentRow & { unpublish_at: string };
}

export function getOrganizationUnitEditor(env: Env, id: string) {
  return requireD1Database(env)
    .prepare(
      `SELECT c.id AS content_id, c.slug, c.title, c.summary, c.owner, c.status,
              c.publish_at, c.unpublish_at, c.revision AS content_revision,
              c.created_at AS content_created_at, c.deleted_at,
              u.parent_content_id, u.unit_kind, u.sort_order,
              u.revision AS unit_revision, u.created_at AS unit_created_at
       FROM organization_units AS u
       JOIN contents AS c ON c.id = u.content_id
       WHERE u.content_id = ? AND c.type = 'organization' AND COALESCE(c.deleted_at, '') = ''
       LIMIT 1`
    )
    .bind(id)
    .first<{
      content_id: string;
      slug: string;
      title: string;
      summary: string;
      owner: string;
      status: string;
      publish_at: string;
      unpublish_at: string;
      content_revision: number;
      content_created_at: string;
      deleted_at: string;
      parent_content_id: string | null;
      unit_kind: string;
      sort_order: number;
      unit_revision: number;
      unit_created_at: string;
    }>();
}

export interface OrganizationUnitInput {
  slug: string;
  title: string;
  summary: string;
  status: "draft" | "review" | "scheduled" | "published";
  publishAt: string;
  unpublishAt: string;
  parentContentId: string | null;
  unitKind: string;
  sortOrder: number;
}

function contentForCreate(id: string, input: OrganizationUnitInput, actor: string, now: string): ContentRow {
  return {
    id,
    slug: input.slug,
    type: "organization",
    status: input.status,
    owner: actor,
    title: input.title,
    summary: input.summary,
    body_snapshot: "",
    category: "",
    tags_json: "[]",
    seo_title: "",
    seo_description: "",
    canonical_url: "",
    featured: 0,
    reading_minutes: 0,
    template: "organization",
    body_doc_id: "",
    body_doc_url: "",
    featured_media_id: "",
    media_ids_json: "[]",
    view_count: 0,
    last_viewed_at: "",
    updated_at: now,
    publish_at: input.publishAt,
    created_at: now,
    deleted_at: "",
    created_by: actor,
    updated_by: actor,
    revision: 0
  };
}

function unitForCreate(id: string, input: OrganizationUnitInput, now: string): OrganizationUnitRow {
  return {
    content_id: id,
    parent_content_id: input.parentContentId,
    unit_kind: input.unitKind,
    sort_order: input.sortOrder,
    settings_json: "{}",
    revision: 0,
    created_at: now,
    updated_at: now
  };
}

function auditStatement(db: D1Database, id: string, action: string, actor: string, now: string, revision?: number) {
  const base = `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)`;
  if (revision === undefined) {
    return db
      .prepare(`${base} VALUES (?, 'organization_unit', ?, ?, ?, ?, '{}')`)
      .bind(`audit-${crypto.randomUUID()}`, id, action, actor, now);
  }
  return db
    .prepare(
      `${base}
       SELECT ?, 'organization_unit', ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM organization_units AS u JOIN contents AS c ON c.id = u.content_id
         WHERE u.content_id = ? AND u.revision = ?
           AND c.revision = ? AND c.updated_at = ?
       )`
    )
    .bind(
      `audit-${crypto.randomUUID()}`,
      id,
      action,
      actor,
      now,
      JSON.stringify({ expectedRevision: revision }),
      id,
      revision + 1,
      revision + 1,
      now
    );
}

export async function createAuditedOrganizationUnit(
  env: Env,
  id: string,
  input: OrganizationUnitInput,
  actor: string,
  now: string
) {
  const db = requireD1Database(env);
  const content = contentForCreate(id, input, actor, now);
  const unit = unitForCreate(id, input, now);
  const contentInsert = db
    .prepare(
      `INSERT INTO contents (${CONTENT_ADMIN_ROW_COLUMNS.join(", ")}, unpublish_at)
       VALUES (${CONTENT_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")}, ?)`
    )
    .bind(...CONTENT_ADMIN_ROW_COLUMNS.map((column) => content[column]), input.unpublishAt);
  const unitInsert = db
    .prepare(
      `INSERT INTO organization_units (${ORGANIZATION_UNIT_ROW_COLUMNS.join(", ")})
       VALUES (${ORGANIZATION_UNIT_ROW_COLUMNS.map(() => "?").join(", ")})`
    )
    .bind(...ORGANIZATION_UNIT_ROW_COLUMNS.map((column) => unit[column]));
  await db.batch([contentInsert, unitInsert, auditStatement(db, id, "create", actor, now)]);
}

export async function updateAuditedOrganizationUnit(
  env: Env,
  id: string,
  input: OrganizationUnitInput,
  revision: number,
  actor: string,
  now: string
) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new RangeError("invalid expected revision");
  const db = requireD1Database(env);
  const contentUpdate = db
    .prepare(
      `UPDATE contents
       SET slug = ?, title = ?, summary = ?, status = ?, publish_at = ?, unpublish_at = ?,
           updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ? AND type = 'organization' AND COALESCE(deleted_at, '') = ''
         AND revision = ?
         AND EXISTS (SELECT 1 FROM organization_units WHERE content_id = ? AND revision = ?)`
    )
    .bind(
      input.slug,
      input.title,
      input.summary,
      input.status,
      input.publishAt,
      input.unpublishAt,
      now,
      actor,
      id,
      revision,
      id,
      revision
    );
  const unitUpdate = db
    .prepare(
      `UPDATE organization_units
       SET parent_content_id = ?, unit_kind = ?, sort_order = ?,
           updated_at = ?, revision = revision + 1
       WHERE content_id = ? AND revision = ?
         AND EXISTS (
           SELECT 1 FROM contents WHERE id = ? AND revision = ? AND updated_at = ?
         )`
    )
    .bind(input.parentContentId, input.unitKind, input.sortOrder, now, id, revision, id, revision + 1, now);
  const audit = auditStatement(db, id, "update", actor, now, revision);
  const result = await db.batch([contentUpdate, unitUpdate, audit]);
  return Number(result[0]?.meta.changes ?? 0) === 1 && Number(result[1]?.meta.changes ?? 0) === 1;
}

/** Archive is safe by default: unpublishes the entire descendant chain. */
export async function unpublishOrganizationUnit(env: Env, id: string, revision: number, actor: string, now: string) {
  const current = await getOrganizationUnitEditor(env, id);
  if (!current || current.unit_revision !== revision || current.content_revision !== revision) return false;
  return updateAuditedOrganizationUnit(
    env,
    id,
    {
      slug: current.slug,
      title: current.title,
      summary: current.summary,
      status: "draft",
      publishAt: "",
      unpublishAt: "",
      parentContentId: current.parent_content_id,
      unitKind: current.unit_kind,
      sortOrder: current.sort_order
    },
    revision,
    actor,
    now
  );
}

/** Destructive removal is restricted by FK children/positions and revision CAS. */
export async function deleteAuditedOrganizationUnit(
  env: Env,
  id: string,
  revision: number,
  actor: string,
  now: string
) {
  const db = requireD1Database(env);
  const audit = db
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       SELECT ?, 'organization_unit', ?, 'delete', ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM contents AS c JOIN organization_units AS u ON u.content_id = c.id
         WHERE c.id = ? AND c.revision = ? AND u.revision = ? AND c.deleted_at = ''
       )`
    )
    .bind(
      `audit-${crypto.randomUUID()}`,
      id,
      actor,
      now,
      JSON.stringify({ expectedRevision: revision }),
      id,
      revision,
      revision
    );
  const removeUnit = db
    .prepare(
      `DELETE FROM organization_units WHERE content_id = ? AND revision = ?
       AND EXISTS (SELECT 1 FROM contents WHERE id = ? AND revision = ? AND deleted_at = '')`
    )
    .bind(id, revision, id, revision);
  const tombstone = db
    .prepare(
      `UPDATE contents SET slug = ?, deleted_at = ?, status = 'draft',
         updated_at = ?, updated_by = ?, revision = revision + 1
       WHERE id = ? AND revision = ? AND deleted_at = ''
         AND NOT EXISTS (SELECT 1 FROM organization_units WHERE content_id = ?)`
    )
    .bind(`__deleted__:${id}`, now, now, actor, id, revision, id);
  const result = await db.batch([audit, removeUnit, tombstone]);
  return Number(result[1]?.meta.changes ?? 0) === 1 && Number(result[2]?.meta.changes ?? 0) === 1;
}
