import type { OrganizationUnitListRow } from "../../features/organization-admin";

export interface FocusedUnitContext {
  parent: OrganizationUnitListRow | null;
  peers: OrganizationUnitListRow[];
  missingParent: boolean;
}

/** A focused, read-only navigation preview. Never infer missing siblings from a paginated slice. */
export function focusedUnitContext(
  selected: OrganizationUnitListRow,
  loadedUnits: readonly OrganizationUnitListRow[]
): FocusedUnitContext {
  const byId = new Map(loadedUnits.map((unit) => [unit.content_id, unit]));
  byId.set(selected.content_id, selected);
  const parent = selected.parent_content_id ? (byId.get(selected.parent_content_id) ?? null) : null;
  const siblings = [...byId.values()]
    .filter((unit) => unit.parent_content_id === selected.parent_content_id)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.title.localeCompare(b.title, "th") || a.content_id.localeCompare(b.content_id)
    );
  return {
    parent,
    peers: siblings,
    missingParent: Boolean(selected.parent_content_id && !parent)
  };
}

