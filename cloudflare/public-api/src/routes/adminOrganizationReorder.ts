import type { AdminIdentity } from "../auth/adminAccess";
import { requireD1Database } from "../db/documentsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

export type OrganizationReorderKind = "positions" | "assignments";
export interface OrganizationOrderEntry {
  id: string;
  revision: number;
}
export interface OrganizationReorderInput {
  collection: OrganizationReorderKind;
  scopeId: string;
  groupLabel: string;
  groupSortOrder: number;
  items: OrganizationOrderEntry[];
}

const identifier = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function parseOrganizationReorder(value: unknown): OrganizationReorderInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("invalid reorder payload");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["collection", "scopeId", "groupLabel", "groupSortOrder", "items"].includes(key))) {
    throw new TypeError("unexpected reorder field");
  }
  if (data.collection !== "positions" && data.collection !== "assignments") throw new TypeError("invalid reorder collection");
  if (typeof data.scopeId !== "string" || !identifier.test(data.scopeId)) throw new TypeError("invalid reorder scope");
  if (!Array.isArray(data.items) || data.items.length < 2 || data.items.length > 500) throw new TypeError("invalid reorder size");
  const seen = new Set<string>();
  const items = data.items.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError("invalid reorder entry");
    const row = entry as Record<string, unknown>;
    if (Object.keys(row).some((key) => !["id", "revision"].includes(key))) throw new TypeError("unexpected reorder entry field");
    if (typeof row.id !== "string" || !identifier.test(row.id) || seen.has(row.id)) throw new TypeError("invalid reorder ID");
    if (typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 0) {
      throw new TypeError("invalid reorder revision");
    }
    seen.add(row.id);
    return { id: row.id, revision: row.revision };
  });
  if (data.collection === "positions") {
    if (typeof data.groupLabel !== "string" || data.groupLabel.length > 160) throw new TypeError("invalid position group");
    if (typeof data.groupSortOrder !== "number" || !Number.isSafeInteger(data.groupSortOrder) || data.groupSortOrder < 0) {
      throw new TypeError("invalid position group order");
    }
  } else if (data.groupLabel !== "" || data.groupSortOrder !== 0) {
    throw new TypeError("assignment reorder cannot change position groups");
  }
  return {
    collection: data.collection,
    scopeId: data.scopeId,
    groupLabel: data.groupLabel as string,
    groupSortOrder: data.groupSortOrder as number,
    items
  };
}

/**
 * D1 batch is transactional. Both the audit and UPDATE are all-or-nothing:
 * the count+revision guards verify the complete sibling set inside the same
 * serialized write transaction. No interleaved partial PATCH requests.
 * Ordering changes never alter unit parentage, personnel, or occupant capacity.
 */
export async function reorderOrganizationRows(
  env: Env,
  input: OrganizationReorderInput,
  actor: string
): Promise<boolean> {
  const db = requireD1Database(env);
  const isPosition = input.collection === "positions";
  const table = isPosition ? "organization_positions" : "organization_assignments";
  const scope = isPosition
    ? "unit_content_id = ?3 AND group_label = ?4 AND group_sort_order = ?5"
    : "position_id = ?3";
  const payload = JSON.stringify(input.items);
  const args = isPosition
    ? [payload, new Date().toISOString(), input.scopeId, input.groupLabel, input.groupSortOrder, input.items.length]
    : [payload, new Date().toISOString(), input.scopeId, input.items.length];
  const countParameter = isPosition ? "?6" : "?4";
  const matchScope = scope.replaceAll(/\b(unit_content_id|group_label|group_sort_order|position_id)\b/g, "member.$1");
  const guard = `(SELECT COUNT(*) FROM ${table} WHERE ${scope}) = ${countParameter}
    AND (SELECT COUNT(*) FROM ${table} AS member
      JOIN json_each(?1) AS entry
        ON member.id = json_extract(entry.value, '$.id')
       AND member.revision = json_extract(entry.value, '$.revision')
      WHERE ${matchScope}) = ${countParameter}`;
  // Write the audit first so it can only be recorded if every incoming
  // revision and the full sibling set match, at the serialized D1 boundary.
  const auditOffset = args.length;
  const audit = db
    .prepare(
      `INSERT INTO admin_audit_log (id, entity_type, entity_id, action, actor, created_at, metadata_json)
       SELECT ?${auditOffset + 1}, ?${auditOffset + 2}, ?${auditOffset + 3}, 'update',
              ?${auditOffset + 4}, ?${auditOffset + 5}, ?${auditOffset + 6} WHERE ${guard}`
    )
    .bind(
      ...args,
      `audit-${crypto.randomUUID()}`,
      isPosition ? "organization_position_order" : "organization_assignment_order",
      input.scopeId,
      actor,
      args[1],
      JSON.stringify({ collection: input.collection, groupLabel: input.groupLabel, groupSortOrder: input.groupSortOrder, items: input.items })
    );
  const update = db
    .prepare(
      `UPDATE ${table}
       SET sort_order = (
           SELECT CAST(entry.key AS INTEGER) FROM json_each(?1) AS entry
           WHERE json_extract(entry.value, '$.id') = ${table}.id
         ),
         updated_at = ?2,
         revision = revision + 1
       WHERE ${scope} AND ${guard}`
    )
    .bind(...args);
  const result = await db.batch([audit, update]);
  return Number(result[1]?.meta.changes ?? 0) === input.items.length;
}

/** Admin-wide session, RBAC, CSRF, origin, step-up and rate limiting already ran. */
export async function handleAdminOrganizationReorder(
  request: Request,
  env: Env,
  segments: readonly string[],
  identity: AdminIdentity
): Promise<Response | null> {
  if (segments.length !== 2 || segments[0] !== "organization" || segments[1] !== "reorder" || request.method !== "POST") {
    return null;
  }
  const raw: unknown = await request.json().catch(() => null);
  let input: OrganizationReorderInput;
  try {
    input = parseOrganizationReorder(raw);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "invalid reorder data", 400, { resource: "organization" });
  }
  const updated = await reorderOrganizationRows(env, input, identity.actor);
  if (!updated) return jsonError("organization ordering changed; refresh and retry", 409, { resource: "organization" });
  return json({ reordered: true, count: input.items.length }, { headers: { "Cache-Control": "no-store" } });
}
