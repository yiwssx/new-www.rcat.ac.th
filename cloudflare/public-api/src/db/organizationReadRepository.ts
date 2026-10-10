import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";

/**
 * Public organization reads are rooted in effectively published ancestors.
 * Scheduled units become visible automatically once publish_at is reached.
 * This prevents a
 * published child from leaking through an unpublished/draft ancestor.
 * Binding ?1 once ensures every layer uses the same visibility timestamp.
 */
const PUBLIC_ORGANIZATION_CTE = `
  WITH RECURSIVE eligible AS (
    SELECT
      unit.content_id,
      unit.parent_content_id,
      unit.unit_kind,
      unit.sort_order,
      content.slug,
      content.title,
      content.summary
    FROM organization_units AS unit
    JOIN contents AS content ON content.id = unit.content_id
    WHERE content.type = 'organization'
      AND (
        content.status = 'published'
        OR (content.status = 'scheduled' AND COALESCE(content.publish_at, '') <> '')
      )
      AND COALESCE(content.deleted_at, '') = ''
      AND (COALESCE(content.publish_at, '') = '' OR datetime(content.publish_at) <= datetime(?1))
      AND (COALESCE(content.unpublish_at, '') = '' OR datetime(content.unpublish_at) > datetime(?1))
  ),
  visible (content_id, parent_content_id, unit_kind, sort_order, slug, title, summary, depth) AS (
    SELECT content_id, parent_content_id, unit_kind, sort_order, slug, title, summary, 0
    FROM eligible
    WHERE parent_content_id IS NULL
    UNION ALL
    SELECT child.content_id, child.parent_content_id, child.unit_kind, child.sort_order,
           child.slug, child.title, child.summary, parent.depth + 1
    FROM eligible AS child
    JOIN visible AS parent ON parent.content_id = child.parent_content_id
  )
`;

export const PUBLIC_ORGANIZATION_HIERARCHY_SQL = `
  ${PUBLIC_ORGANIZATION_CTE}
  SELECT content_id, parent_content_id, unit_kind, sort_order, slug, title, summary, depth
  FROM visible
  ORDER BY depth ASC, sort_order ASC, title COLLATE NOCASE ASC, content_id ASC
`;

// ASVS 1.2.4 / 8.2.3: all current-time parameters are bound, and the public
// projection enumerates columns rather than exposing entire personnel rows.
export const PUBLIC_ORGANIZATION_POSITIONS_SQL = `
  ${PUBLIC_ORGANIZATION_CTE}
  SELECT
    position.id AS position_id,
    position.unit_content_id,
    position.title AS position_title,
    position.group_label,
    position.group_sort_order,
    position.sort_order AS position_sort_order,
    position.display_style,
    assignment.id AS assignment_id,
    assignment.duty_detail,
    assignment.sort_order AS assignment_sort_order,
    person.id AS person_id,
    person.display_name,
    person.personnel_type,
    person.employment_position,
    person.photo_media_id,
    CASE WHEN person.show_public_email = 1 THEN person.public_email ELSE '' END AS public_email,
    CASE WHEN person.show_public_phone = 1 THEN person.public_phone ELSE '' END AS public_phone
  FROM visible AS unit
  JOIN organization_positions AS position ON position.unit_content_id = unit.content_id
  LEFT JOIN organization_assignments AS assignment
    ON assignment.position_id = position.id
    AND assignment.enabled = 1
  LEFT JOIN personnel AS person ON person.id = assignment.personnel_id AND person.active = 1
  ORDER BY unit.depth ASC, unit.sort_order ASC, unit.content_id ASC,
           position.group_sort_order ASC, position.sort_order ASC, position.id ASC,
           assignment.sort_order ASC, assignment.id ASC
`;

export interface PublicOrganizationUnitRow {
  content_id: string;
  parent_content_id: string | null;
  unit_kind: string;
  sort_order: number;
  slug: string;
  title: string;
  summary: string;
  depth: number;
}

export interface PublicOrganizationUnit {
  contentId: string;
  parentContentId: string | null;
  unitKind: string;
  sortOrder: number;
  slug: string;
  title: string;
  summary: string;
  depth: number;
}

export function mapPublicOrganizationUnit(row: PublicOrganizationUnitRow): PublicOrganizationUnit {
  return {
    contentId: row.content_id,
    parentContentId: row.parent_content_id,
    unitKind: row.unit_kind,
    sortOrder: row.sort_order,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    depth: row.depth
  };
}

export async function listPublishedOrganizationUnits(env: Env): Promise<PublicOrganizationUnit[]> {
  const result = await requireD1Database(env)
    .prepare(PUBLIC_ORGANIZATION_HIERARCHY_SQL)
    .bind(new Date().toISOString())
    .all<PublicOrganizationUnitRow>();

  return (result.results ?? []).map(mapPublicOrganizationUnit);
}

export interface PublicOrganizationPositionRow {
  position_id: string;
  unit_content_id: string;
  position_title: string;
  group_label: string;
  group_sort_order: number;
  position_sort_order: number;
  display_style: string;
  assignment_id: string | null;
  duty_detail: string | null;
  assignment_sort_order: number | null;
  person_id: string | null;
  display_name: string | null;
  personnel_type: string | null;
  employment_position: string | null;
  photo_media_id: string | null;
  public_email: string | null;
  public_phone: string | null;
}

export interface PublicOrganizationPositionAssignment {
  id: string;
  dutyDetail: string;
  sortOrder: number;
  person: {
    id: string;
    displayName: string;
    personnelType: string;
    employmentPosition: string;
    photoMediaId: string | null;
    publicEmail: string;
    publicPhone: string;
  };
}

export interface PublicOrganizationPosition {
  id: string;
  unitContentId: string;
  title: string;
  groupLabel: string;
  groupSortOrder: number;
  sortOrder: number;
  displayStyle: string;
  assignments: PublicOrganizationPositionAssignment[];
}

/** Empty positions remain present; hidden or inactive personnel never appear. */
export function mapPublicOrganizationPositions(
  rows: readonly PublicOrganizationPositionRow[]
): PublicOrganizationPosition[] {
  const positions = new Map<string, PublicOrganizationPosition>();

  for (const row of rows) {
    let position = positions.get(row.position_id);
    if (!position) {
      position = {
        id: row.position_id,
        unitContentId: row.unit_content_id,
        title: row.position_title,
        groupLabel: row.group_label,
        groupSortOrder: row.group_sort_order,
        sortOrder: row.position_sort_order,
        displayStyle: row.display_style,
        assignments: []
      };
      positions.set(row.position_id, position);
    }

    if (row.assignment_id !== null && row.person_id !== null && row.display_name !== null) {
      position.assignments.push({
        id: row.assignment_id,
        dutyDetail: row.duty_detail ?? "",
        sortOrder: row.assignment_sort_order ?? 0,
        person: {
          id: row.person_id,
          displayName: row.display_name,
          personnelType: row.personnel_type ?? "",
          employmentPosition: row.employment_position ?? "",
          photoMediaId: row.photo_media_id,
          publicEmail: row.public_email ?? "",
          publicPhone: row.public_phone ?? ""
        }
      });
    }
  }

  return [...positions.values()];
}

/**
 * Read both public projections against the same UTC instant. No N+1 queries.
 * Active/visible parent chains are enforced by the common recursive CTE.
 */
export async function readPublishedOrganization(env: Env) {
  const timestamp = new Date().toISOString();
  const database = requireD1Database(env);
  const [unitRows, positionRows] = await Promise.all([
    database.prepare(PUBLIC_ORGANIZATION_HIERARCHY_SQL).bind(timestamp).all<PublicOrganizationUnitRow>(),
    database.prepare(PUBLIC_ORGANIZATION_POSITIONS_SQL).bind(timestamp).all<PublicOrganizationPositionRow>()
  ]);

  return {
    items: (unitRows.results ?? []).map(mapPublicOrganizationUnit),
    positions: mapPublicOrganizationPositions(positionRows.results ?? [])
  };
}
