import type { Env } from "../env";
import { requireD1Database } from "../db/documentsRepository";

const identifier = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export interface PositionLayoutItem {
  id: string;
  revision: number;
}
export interface PositionLayoutGroup {
  label: string;
  items: PositionLayoutItem[];
}
export interface PositionLayoutInput {
  collection: "position-layout";
  scopeId: string;
  groups: PositionLayoutGroup[];
}

export function parsePositionLayout(value: unknown): PositionLayoutInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("invalid position layout");
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !["collection", "scopeId", "groups"].includes(key)) ||
    body.collection !== "position-layout" ||
    typeof body.scopeId !== "string" ||
    !identifier.test(body.scopeId) ||
    !Array.isArray(body.groups) ||
    body.groups.length < 1 ||
    body.groups.length > 100
  ) {
    throw new TypeError("invalid position layout scope");
  }
  const seenPositions = new Set<string>();
  const seenGroups = new Set<string>();
  const groups = body.groups.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("invalid position group");
    const group = raw as Record<string, unknown>;
    if (
      Object.keys(group).some((key) => !["label", "items"].includes(key)) ||
      typeof group.label !== "string" ||
      group.label.length > 160 ||
      seenGroups.has(group.label) ||
      !Array.isArray(group.items) ||
      group.items.length < 1
    ) {
      throw new TypeError("invalid position group content");
    }
    seenGroups.add(group.label);
    const items = group.items.map((rawItem: unknown) => {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem))
        throw new TypeError("invalid position layout entry");
      const item = rawItem as Record<string, unknown>;
      if (
        Object.keys(item).some((key) => !["id", "revision"].includes(key)) ||
        typeof item.id !== "string" ||
        !identifier.test(item.id) ||
        seenPositions.has(item.id) ||
        typeof item.revision !== "number" ||
        !Number.isSafeInteger(item.revision) ||
        item.revision < 0
      ) {
        throw new TypeError("invalid position layout entry");
      }
      seenPositions.add(item.id);
      if (seenPositions.size > 500) throw new TypeError("too many positions in layout");
      return { id: item.id, revision: item.revision };
    });
    return { label: group.label, items };
  });
  return { collection: "position-layout", scopeId: body.scopeId, groups };
}

/**
 * One full-unit, fail-closed and revision-guarded D1 transaction. A group move,
 * group reorder, and in-group position reorder all update the same authoritative
 * layout; no personnel, assignments or organizational parentage are modified.
 */
export async function saveAuditedPositionLayout(env: Env, input: PositionLayoutInput, actor: string): Promise<boolean> {
  const db = requireD1Database(env);
  const flattened = input.groups.flatMap((group, groupSortOrder) =>
    group.items.map((item, sortOrder) => ({
      ...item,
      groupLabel: group.label,
      groupSortOrder,
      sortOrder
    }))
  );
  const json = JSON.stringify(flattened);
  const now = new Date().toISOString();
  const count = flattened.length;
  const guard = `(SELECT COUNT(*) FROM organization_positions WHERE unit_content_id = ?3) = ?4
    AND (SELECT COUNT(*) FROM organization_positions AS member
       JOIN json_each(?1) AS entry ON member.id = json_extract(entry.value, '$.id')
         AND member.revision = json_extract(entry.value, '$.revision')
       WHERE member.unit_content_id = ?3) = ?4`;
  const params = [json, now, input.scopeId, count];
  const audit = db
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       SELECT ?5, 'organization_position_layout', ?3, 'update', ?6, ?2, ?7 WHERE ${guard}`
    )
    .bind(
      ...params,
      `audit-${crypto.randomUUID()}`,
      actor,
      JSON.stringify({ scopeId: input.scopeId, groups: input.groups })
    );
  const update = db
    .prepare(
      `UPDATE organization_positions
       SET group_label = (SELECT json_extract(entry.value, '$.groupLabel')
                          FROM json_each(?1) AS entry WHERE json_extract(entry.value, '$.id') = organization_positions.id),
           group_sort_order = (SELECT json_extract(entry.value, '$.groupSortOrder')
                               FROM json_each(?1) AS entry WHERE json_extract(entry.value, '$.id') = organization_positions.id),
           sort_order = (SELECT json_extract(entry.value, '$.sortOrder')
                         FROM json_each(?1) AS entry WHERE json_extract(entry.value, '$.id') = organization_positions.id),
           updated_at = ?2,
           revision = revision + 1
       WHERE unit_content_id = ?3 AND ${guard}`
    )
    .bind(...params);
  const results = await db.batch([audit, update]);
  return Number(results[1]?.meta.changes ?? 0) === count;
}
