import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  ORGANIZATION_ASSIGNMENT_ROW_COLUMNS,
  ORGANIZATION_POSITION_ROW_COLUMNS,
  PERSONNEL_ROW_COLUMNS
} from "./organizationSchema";

export type OrganizationSearchCollection = "units" | "personnel" | "positions" | "assignments";

export interface OrganizationPageSearch {
  limit: number;
  offset: number;
  search?: string;
  unitContentId?: string;
  positionId?: string;
}

/**
 * Single bounded list query plus a count query; never load an entire directory
 * or issue queries per row. All identifiers are static, every input is bound.
 */
export async function searchAdminOrganizationPage(
  env: Env,
  collection: OrganizationSearchCollection,
  { limit, offset, search = "", unitContentId, positionId }: OrganizationPageSearch
) {
  const columns = {
    units: `u.content_id, u.parent_content_id, u.unit_kind, u.sort_order,
      COALESCE(json_extract(u.settings_json, '$.chartMode'), 'cards') AS chart_mode,
      COALESCE(json_extract(u.settings_json, '$.chartLayout'), '{}') AS chart_layout,
      u.revision AS unit_revision, c.slug, c.title, c.summary, c.status, c.publish_at, c.unpublish_at,
      c.revision AS content_revision`,
    personnel: PERSONNEL_ROW_COLUMNS.map((column) => `r.${column}`).join(", "),
    positions: ORGANIZATION_POSITION_ROW_COLUMNS.map((column) => `r.${column}`).join(", "),
    assignments: ORGANIZATION_ASSIGNMENT_ROW_COLUMNS.map((column) => `r.${column}`).join(", ")
  };
  const tables = {
    units: "organization_units AS u JOIN contents AS c ON c.id = u.content_id",
    personnel: "personnel AS r",
    positions: "organization_positions AS r",
    assignments: "organization_assignments AS r"
  };
  const ordering = {
    units: "u.sort_order ASC, c.title COLLATE NOCASE ASC, u.content_id ASC",
    personnel: "r.display_name COLLATE NOCASE ASC, r.id ASC",
    positions: "r.group_sort_order ASC, r.sort_order ASC, r.id ASC",
    assignments: "r.sort_order ASC, r.id ASC"
  };
  const searchFields = {
    units: ["c.title", "c.slug", "u.unit_kind"],
    personnel: ["r.display_name", "r.personnel_type", "r.employment_position"],
    positions: ["r.title", "r.group_label"],
    assignments: ["r.duty_detail", "r.personnel_id", "r.position_id"]
  };
  const clauses = collection === "units" ? ["c.type = 'organization'", "COALESCE(c.deleted_at, '') = ''"] : [];
  const values: string[] = [];
  if (search.trim()) {
    const fields = searchFields[collection];
    clauses.push("(" + fields.map((field) => `instr(lower(COALESCE(${field}, '')), lower(?)) > 0`).join(" OR ") + ")");
    values.push(...fields.map(() => search.trim()));
  }
  if (unitContentId) {
    if (collection === "positions") {
      clauses.push("r.unit_content_id = ?");
    } else if (collection === "assignments") {
      clauses.push("r.position_id IN (SELECT id FROM organization_positions WHERE unit_content_id = ?)");
    } else {
      throw new RangeError("unit filter is only valid for positions and assignments");
    }
    values.push(unitContentId);
  }
  if (positionId) {
    if (collection !== "assignments") throw new RangeError("position filter is only valid for assignments");
    clauses.push("r.position_id = ?");
    values.push(positionId);
  }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const database = requireD1Database(env);
  const totalRow = await database
    .prepare(`SELECT COUNT(*) AS total FROM ${tables[collection]}${where}`)
    .bind(...values)
    .first<{ total: number }>();
  const page = await database
    .prepare(`SELECT ${columns[collection]} FROM ${tables[collection]}${where} ORDER BY ${ordering[collection]} LIMIT ? OFFSET ?`)
    .bind(...values, limit, offset)
    .all<Record<string, unknown>>();
  return { items: page.results ?? [], total: totalRow?.total ?? 0 };
}
