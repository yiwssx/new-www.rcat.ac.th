import type { PublicOrganizationPosition, PublicOrganizationUnit } from "./api";

/** Page-view filtering only. The API may include every published descendant; no data is changed. */
export type OrganizationPersonnelScope = "direct" | "all" | `unit:${string}`;

export function isAcademicDivision(unit: Pick<PublicOrganizationUnit, "unitKind" | "title">) {
  return unit.unitKind === "division" && /ฝ่าย\s*วิชาการ/u.test(unit.title);
}

/** Academic divisions default to the owner's approved B view. Other divisions show the whole subtree. */
export function defaultOrganizationPersonnelScope(
  unit: Pick<PublicOrganizationUnit, "unitKind" | "title">
): OrganizationPersonnelScope {
  if (unit.unitKind !== "division" || isAcademicDivision(unit)) return "direct";
  return "all";
}

export function selectOrganizationPersonnelUnits(
  root: PublicOrganizationUnit,
  units: readonly PublicOrganizationUnit[],
  scope: OrganizationPersonnelScope
): ReadonlySet<string> {
  const visibleIds = new Set(units.map((unit) => unit.contentId));
  if (root.unitKind !== "division" || scope === "direct") return new Set([root.contentId]);
  if (scope === "all") return visibleIds;
  const unitId = scope.startsWith("unit:") ? scope.slice(5) : "";
  // The chosen unit must exist within this published subtree: never expose a sibling branch.
  return unitId !== root.contentId && visibleIds.has(unitId) ? new Set([unitId]) : new Set([root.contentId]);
}

export function selectOrganizationPersonnelPositions(
  root: PublicOrganizationUnit,
  units: readonly PublicOrganizationUnit[],
  positions: readonly PublicOrganizationPosition[],
  scope: OrganizationPersonnelScope
): PublicOrganizationPosition[] {
  const selected = selectOrganizationPersonnelUnits(root, units, scope);
  return positions.filter((position) => selected.has(position.unitContentId));
}

export function publishedDepartmentLinks(units: readonly PublicOrganizationUnit[]) {
  const seen = new Set<string>();
  return units
    .filter((unit) => {
      if (unit.unitKind !== "department" || seen.has(unit.contentId)) return false;
      seen.add(unit.contentId);
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "th"));
}
