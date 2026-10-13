import type { PublicOrganizationUnit } from "./api";

/** Keep public tree construction bounded even for malformed or unexpectedly large payloads. */
export const MAX_PUBLIC_ORGANIZATION_UNITS = 5000;
export const MAX_PUBLIC_ORGANIZATION_DEPTH = 128;

export interface PublicOrganizationUnitBranch {
  unit: PublicOrganizationUnit;
  level: number;
  children: PublicOrganizationUnitBranch[];
}

export type PublicOrganizationHierarchyIssue =
  "missing-root" | "duplicate-id" | "missing-parent" | "disconnected" | "cycle" | "depth-limit" | "node-limit";

export interface PublicOrganizationHierarchy {
  root: PublicOrganizationUnitBranch | null;
  includedUnitCount: number;
  excludedUnitCount: number;
  issues: PublicOrganizationHierarchyIssue[];
}

/**
 * Derives a diagram-only tree from the already published, scoped public detail response.
 * All parent links are resolved by ID, never inferred from the API's depth or input order.
 * Does not fetch or mutate personnel, roles, chart modes, or position layouts.
 */
export function buildPublicOrganizationHierarchy(
  units: readonly PublicOrganizationUnit[],
  rootContentId: string
): PublicOrganizationHierarchy {
  const issues = new Set<PublicOrganizationHierarchyIssue>();
  if (units.length > MAX_PUBLIC_ORGANIZATION_UNITS) {
    return {
      root: null,
      includedUnitCount: 0,
      excludedUnitCount: units.length,
      issues: ["node-limit"]
    };
  }

  const byId = new Map<string, PublicOrganizationUnit>();
  for (const unit of units) {
    if (!unit.contentId || byId.has(unit.contentId)) {
      issues.add("duplicate-id");
      continue;
    }
    byId.set(unit.contentId, unit);
  }

  const selected = byId.get(rootContentId);
  if (!selected) {
    return {
      root: null,
      includedUnitCount: 0,
      excludedUnitCount: units.length,
      issues: [...issues, "missing-root"]
    };
  }

  const childrenByParent = new Map<string, PublicOrganizationUnit[]>();
  for (const unit of byId.values()) {
    if (unit.contentId === rootContentId) continue;
    if (unit.parentContentId === unit.contentId) {
      issues.add("cycle");
      continue;
    }
    if (!unit.parentContentId || !byId.has(unit.parentContentId)) {
      issues.add("missing-parent");
      continue;
    }
    const children = childrenByParent.get(unit.parentContentId) ?? [];
    children.push(unit);
    childrenByParent.set(unit.parentContentId, children);
  }

  const compare = (a: PublicOrganizationUnit, b: PublicOrganizationUnit) =>
    a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "th") || a.contentId.localeCompare(b.contentId);
  for (const siblings of childrenByParent.values()) siblings.sort(compare);

  const root: PublicOrganizationUnitBranch = { unit: selected, level: 0, children: [] };
  const seen = new Set([rootContentId]);
  // Iterative traversal avoids recursive stack overflow for anomalously deep hierarchies.
  const pending = [root];
  for (let index = 0; index < pending.length; index += 1) {
    const parent = pending[index];
    for (const child of childrenByParent.get(parent.unit.contentId) ?? []) {
      if (seen.has(child.contentId)) {
        issues.add("cycle");
        continue;
      }
      if (parent.level >= MAX_PUBLIC_ORGANIZATION_DEPTH) {
        issues.add("depth-limit");
        continue;
      }
      const node: PublicOrganizationUnitBranch = { unit: child, level: parent.level + 1, children: [] };
      seen.add(child.contentId);
      parent.children.push(node);
      pending.push(node);
    }
  }

  // Disconnected components or circular parent references must never be hoisted
  // into the selected root; doing so could render unrelated/unpublished branches.
  for (const unit of byId.values()) {
    if (seen.has(unit.contentId)) continue;
    const parentPath = new Set<string>();
    let current: PublicOrganizationUnit | undefined = unit;
    while (current && !seen.has(current.contentId)) {
      if (parentPath.has(current.contentId)) {
        issues.add("cycle");
        break;
      }
      parentPath.add(current.contentId);
      current = current.parentContentId ? byId.get(current.parentContentId) : undefined;
    }
    if (!current) issues.add("disconnected");
  }

  return {
    root,
    includedUnitCount: seen.size,
    excludedUnitCount: units.length - seen.size,
    issues: [...issues]
  };
}
