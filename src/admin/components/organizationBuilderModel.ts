import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";
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
  const children = new Map<string, OrganizationUnitListRow[]>();
  for (const unit of sorted) {
    if (!unit.parent_content_id) continue;
    const siblings = children.get(unit.parent_content_id) ?? [];
    siblings.push(unit);
    children.set(unit.parent_content_id, siblings);
  }
  function descend(root: OrganizationUnitListRow, detached: boolean) {
    const stack: OrganizationTreeNode[] = [{ unit: root, depth: 0, detached }];
    while (stack.length) {
      const current = stack.pop();
      if (!current || visited.has(current.unit.content_id)) continue;
      visited.add(current.unit.content_id);
      result.push(current);
      const descendants = children.get(current.unit.content_id) ?? [];
      for (let index = descendants.length - 1; index >= 0; index--) {
        stack.push({ unit: descendants[index], depth: current.depth + 1, detached: false });
      }
    }
  }
  for (const unit of sorted) {
    if (!unit.parent_content_id || !byId.has(unit.parent_content_id)) {
      descend(unit, Boolean(unit.parent_content_id));
    }
  }
  // Broken/cyclic/partially loaded graphs must never hang or silently hide units.
  for (const unit of sorted) descend(unit, true);
  return result;
}

export function positionsForUnit(positions: readonly OrganizationPositionRow[], unitId: string) {
  return positions
    .filter((position) => position.unit_content_id === unitId)
    .sort(
      (a, b) =>
        a.group_sort_order - b.group_sort_order || a.sort_order - b.sort_order || a.title.localeCompare(b.title, "th")
    );
}

/** Only pass a complete assignment dataset; D1 remains authoritative for limits. */
export function enabledDistinctOccupants(
  assignments: readonly OrganizationAssignmentRow[],
  positionId: string
): number {
  return new Set(
    assignments.filter((item) => item.position_id === positionId && item.enabled === 1).map((item) => item.personnel_id)
  ).size;
}

/** Keep stored sub-minute precision if a Thai-local date input is untouched. */
export function assignmentDateToUtc(localInput: string, originalUtc = ""): string | null {
  if (!localInput) return "";
  if (originalUtc && localInput === toLocalDateTimeInputValue(originalUtc)) return originalUtc;
  const parsed = fromLocalDateTimeInputValue(localInput);
  return parsed ? new Date(parsed).toISOString() : null;
}
