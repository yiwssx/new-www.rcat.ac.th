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

/** Nested, cycle-tolerant items for MUI X RichTreeView. */
export interface OrganizationTreeItem {
  id: string;
  label: string;
  children: OrganizationTreeItem[];
}

export function organizationTreeItems(units: readonly OrganizationUnitListRow[]): OrganizationTreeItem[] {
  const roots: OrganizationTreeItem[] = [];
  const ancestors: OrganizationTreeItem[] = [];
  for (const { unit, depth, detached } of flattenOrganizationHierarchy(units)) {
    const item: OrganizationTreeItem = {
      id: unit.content_id,
      label: unit.title + (detached ? " (ไม่พบหน่วยงานแม่ในข้อมูลที่โหลด)" : ""),
      children: []
    };
    if (depth === 0) roots.push(item);
    else (ancestors[depth - 1]?.children ?? roots).push(item);
    ancestors.length = depth;
    ancestors.push(item);
  }
  return roots;
}

export interface OrganizationPositionGroup {
  label: string;
  positions: OrganizationPositionRow[];
}

/** Group identity is the label, not its historical sort index.
 * Legacy data can repeat group_sort_order or spread a label across indices;
 * displaying one contiguous group makes drag targets and positions deterministic.
 */
export function positionGroupsForUnit(positions: readonly OrganizationPositionRow[], unitId: string) {
  const groups = new Map<string, OrganizationPositionGroup>();
  const order = new Map<string, number>();
  for (const position of positions) {
    if (position.unit_content_id !== unitId) continue;
    const group = groups.get(position.group_label) ?? { label: position.group_label, positions: [] };
    group.positions.push(position);
    groups.set(position.group_label, group);
    order.set(position.group_label, Math.min(order.get(position.group_label) ?? Infinity, position.group_sort_order));
  }
  return [...groups.values()]
    .sort((a, b) => (order.get(a.label) ?? 0) - (order.get(b.label) ?? 0) || a.label.localeCompare(b.label, "th"))
    .map((group) => ({
      ...group,
      positions: group.positions.sort(
        (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "th") || a.id.localeCompare(b.id)
      )
    }));
}

export function positionsForUnit(positions: readonly OrganizationPositionRow[], unitId: string) {
  return positionGroupsForUnit(positions, unitId).flatMap((group) => group.positions);
}

/** An assignment never moves when its organizational position changes group. */
export function movePositionBetweenGroups(
  groups: readonly OrganizationPositionGroup[],
  positionId: string,
  targetLabel: string
): OrganizationPositionGroup[] {
  const source = groups.find((group) => group.positions.some((position) => position.id === positionId));
  const target = groups.find((group) => group.label === targetLabel);
  if (!source || !target || source.label === target.label)
    return groups.map((group) => ({ ...group, positions: [...group.positions] }));
  const moved = source.positions.find((position) => position.id === positionId);
  if (!moved) return groups.map((group) => ({ ...group, positions: [...group.positions] }));
  return groups
    .map((group) => ({
      ...group,
      positions:
        group.label === targetLabel
          ? [...group.positions, moved]
          : group.positions.filter((position) => position.id !== positionId)
    }))
    .filter((group) => group.positions.length > 0);
}

/** Append after the highest persisted order; zero remains the canonical first value. */
export function nextOrganizationSortOrder<T>(items: readonly T[], orderOf: (item: T) => number): number {
  return Math.max(items.length, items.reduce((max, item) => Math.max(max, orderOf(item)), -1) + 1);
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
