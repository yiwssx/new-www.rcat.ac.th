import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";

/**
 * Public organization reads are rooted in published ancestors. This prevents a
 * published child from leaking through an unpublished/draft ancestor.
 * Binding ?1 once ensures every layer uses the same visibility timestamp.
 */
export const PUBLIC_ORGANIZATION_HIERARCHY_SQL = `
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
      AND content.status = 'published'
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
  SELECT content_id, parent_content_id, unit_kind, sort_order, slug, title, summary, depth
  FROM visible
  ORDER BY depth ASC, sort_order ASC, title COLLATE NOCASE ASC, content_id ASC
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
