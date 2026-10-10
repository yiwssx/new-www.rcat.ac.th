import type {
  OrganizationAssignmentRow,
  OrganizationPositionRow,
  OrganizationUnitListRow
} from "../../features/organization-admin/api";

export interface OrganizationTreeNode {
  unit: OrganizationUnitListRow;
  depth: number;
  detached: boolean;
}

/** Builds a stable, fully accessible reading order without assuming a fixed hierarchy depth. */
export function flattenOrganizationHierarchy(units: readonly OrganizationUnitListRow[]): OrganizationTreeNode[] {
  const byId = new Map(units.map((unit) => [unit.content_id, unit]));
  const sorted = [...units].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "th"));
  const visited = new Set<string>();
  const result: OrganizationTreeNode[] = [];
  function descend(unit: OrganizationUnitListRow, depth: number, detached: boolean) {
    if (visited.has(unit.content_id)) return;
    visited.add(unit.content_id);
    result.push({ unit, depth, detached });
    for (const child of sorted) {
      if (child.parent_content_id === unit.content_id) descend(child, depth + 1, false);
    }
  }
  for (const unit of sorted) {
    if (!unit.parent_content_id || !byId.has(unit.parent_content_id)) {
      descend(unit, 0, Boolean(unit.parent_content_id));
    }
  }
  // Corrupt/partially loaded cycles must never hang the editor or suppress records.
  for (const unit of sorted) descend(unit, 0, true);
  return result;
}

export function positionsForUnit(positions: readonly OrganizationPositionRow[], unitId: string) {
  return positions
    .filter((position) => position.unit_content_id === unitId)
    .sort(
      (a, b) =>
        a.group_sort_order - b.group_sort_order ||
        a.sort_order - b.sort_order ||
        a.title.localeCompare(b.title, "th")
    );
}

/** Only pass a complete assignment dataset; D1 remains authoritative for limits. */
export function enabledDistinctOccupants(
  assignments: readonly OrganizationAssignmentRow[],
  positionId: string
): number {
  return new Set(
    assignments
      .filter((item) => item.position_id === positionId && item.enabled === 1)
      .map((item) => item.personnel_id)
  ).size;
}
