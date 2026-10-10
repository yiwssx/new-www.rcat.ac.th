/**
 * Organization Chart domain contracts. An organization unit has its own CMS
 * content row; a person is independent of CMS authentication identities.
 */
export const ORGANIZATION_CONTENT_TYPE = "organization" as const;

export const ORGANIZATION_UNIT_KINDS = ["division", "work", "department", "program", "subunit"] as const;

export type OrganizationUnitKind = (typeof ORGANIZATION_UNIT_KINDS)[number];

export interface OrganizationUnit {
  contentId: string;
  parentContentId: string | null;
  unitKind: OrganizationUnitKind;
  sortOrder: number;
  revision: number;
}

export interface OrganizationPerson {
  id: string;
  displayName: string;
  personnelType: string;
  employmentPosition: string;
  photoMediaId: string | null;
  publicEmail: string;
  publicPhone: string;
  showPublicEmail: boolean;
  showPublicPhone: boolean;
  active: boolean;
  revision: number;
}

export interface OrganizationPosition {
  id: string;
  unitContentId: string;
  title: string;
  groupLabel: string;
  groupSortOrder: number;
  sortOrder: number;
  displayStyle: string;
  occupantLimit: number | null;
  revision: number;
}

export interface OrganizationAssignment {
  id: string;
  personnelId: string;
  positionId: string;
  dutyDetail: string;
  sortOrder: number;
  enabled: boolean;
  revision: number;
}

/** Matches the CMS editor's internationalized 160-character organization slug contract. */
export function isValidOrganizationPublicSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 160 &&
    /^[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:-[\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*$/u.test(value)
  );
}

export function isOrganizationUnitKind(value: unknown): value is OrganizationUnitKind {
  return typeof value === "string" && ORGANIZATION_UNIT_KINDS.some((kind) => kind === value);
}

export type OrganizationHierarchyError = "missing-parent" | "self-parent" | "cycle";

/**
 * Check a proposed parent edit against an already-loaded set of unit records.
 * The Worker must repeat this validation inside a serialized D1 write; the
 * migration also enforces cycle prevention independently.
 */
export function validateOrganizationParent(
  units: readonly Pick<OrganizationUnit, "contentId" | "parentContentId">[],
  contentId: string,
  nextParentContentId: string | null
): { ok: true } | { ok: false; error: OrganizationHierarchyError } {
  if (nextParentContentId === null) return { ok: true };
  if (nextParentContentId === contentId) return { ok: false, error: "self-parent" };

  const parents = new Map(units.map((unit) => [unit.contentId, unit.parentContentId]));
  const seen = new Set<string>();
  let cursor: string | null = nextParentContentId;

  while (cursor !== null) {
    if (!parents.has(cursor)) return { ok: false, error: "missing-parent" };
    if (cursor === contentId || seen.has(cursor)) return { ok: false, error: "cycle" };
    seen.add(cursor);
    cursor = parents.get(cursor) ?? null;
  }
  return { ok: true };
}

/** The public profile is explicitly opt-in at each contact-field boundary. */
export function projectOrganizationPersonPublic(person: OrganizationPerson) {
  return {
    id: person.id,
    displayName: person.displayName,
    personnelType: person.personnelType,
    employmentPosition: person.employmentPosition,
    photoMediaId: person.photoMediaId,
    publicEmail: person.showPublicEmail ? person.publicEmail : "",
    publicPhone: person.showPublicPhone ? person.publicPhone : ""
  };
}
