import { readPublishedOrganization } from "../db/organizationReadRepository";
import { isValidOrganizationPublicSlug } from "../../../../shared/organizationContracts";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import type { PublicOrganizationUnit } from "../db/organizationReadRepository";
import { readPublicMediaRowsByIds } from "../db/publicMetadataRepository";
import { mapMediaAssetRowToPublicMediaAsset } from "../adapters/publicMediaAdapter";

/**
 * ASVS 8.2.3: expose only published organization chains, active assignments
 * and explicitly opted-in personnel contact fields. Never return raw D1 rows.
 */
export async function publicOrganization(env: Env): Promise<Response> {
  const organization = await readPublishedOrganization(env);
  return json(organization, {
    headers: { "Cache-Control": "public, max-age=60" }
  });
}

/** A detail permalink can only resolve a fully published ancestor chain. */
export function selectPublishedOrganizationDetail(
  organization: Awaited<ReturnType<typeof readPublishedOrganization>>,
  slug: string
) {
  const unit = organization.items.find((item) => item.slug === slug);
  if (!unit) return null;
  const byId = new Map(organization.items.map((item) => [item.contentId, item]));
  const ancestors: PublicOrganizationUnit[] = [];
  const visited = new Set([unit.contentId]);
  let parentId = unit.parentContentId;
  while (parentId) {
    if (visited.has(parentId)) return null;
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) return null;
    ancestors.unshift(parent);
    parentId = parent.parentContentId;
  }
  const isDescendant = (candidate: PublicOrganizationUnit) => {
    const seen = new Set<string>();
    let current: PublicOrganizationUnit | undefined = candidate;
    while (current) {
      if (current.contentId === unit.contentId) return true;
      if (seen.has(current.contentId)) return false;
      seen.add(current.contentId);
      current = current.parentContentId ? byId.get(current.parentContentId) : undefined;
    }
    return false;
  };
  const descendants = organization.items.filter(isDescendant);
  const children = new Map<string, PublicOrganizationUnit[]>();
  for (const candidate of descendants) {
    if (candidate.contentId === unit.contentId || !candidate.parentContentId) continue;
    const siblings = children.get(candidate.parentContentId) ?? [];
    siblings.push(candidate);
    children.set(candidate.parentContentId, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((left, right) =>
      left.sortOrder - right.sortOrder ||
      left.title.localeCompare(right.title, "th") ||
      left.contentId.localeCompare(right.contentId)
    );
  }
  // The SQL visible CTE returns breadth-first rows; render preorder instead so
  // grandchildren follow their actual parent, not an unrelated sibling.
  const units: PublicOrganizationUnit[] = [];
  const added = new Set<string>();
  function visit(current: PublicOrganizationUnit) {
    if (added.has(current.contentId)) return;
    added.add(current.contentId);
    units.push(current);
    for (const child of children.get(current.contentId) ?? []) visit(child);
  }
  visit(unit);
  const visibleIds = new Set(units.map((item) => item.contentId));
  return {
    unit,
    ancestors,
    units,
    positions: organization.positions.filter((position) => visibleIds.has(position.unitContentId))
  };
}

export async function publicOrganizationDetail(env: Env, slug: string): Promise<Response> {
  if (!isValidOrganizationPublicSlug(slug)) {
    return jsonError("not found", 404, { resource: "organization" });
  }
  const organization = await readPublishedOrganization(env);
  const result = selectPublishedOrganizationDetail(organization, slug);
  if (!result) return jsonError("not found", 404, { resource: "organization" });
  const photoIds = result.positions.flatMap((position) =>
    position.assignments.map((assignment) => assignment.person.photoMediaId).filter((id): id is string => Boolean(id))
  );
  const mediaRows = await readPublicMediaRowsByIds(env, photoIds);
  const media = mediaRows.filter((row) => row.type === "image").map(mapMediaAssetRowToPublicMediaAsset);
  return json({ ...result, media }, { headers: { "Cache-Control": "public, max-age=60" } });
}
