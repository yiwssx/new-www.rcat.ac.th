import { requestCloudflareAdmin } from "../admin-write/cloudflareApi";

export const ORGANIZATION_COLLECTIONS = ["units", "personnel", "positions", "assignments"] as const;
export type OrganizationCollection = (typeof ORGANIZATION_COLLECTIONS)[number];

export interface OrganizationUnitListRow {
  content_id: string;
  parent_content_id: string | null;
  unit_kind: string;
  sort_order: number;
  slug: string;
  title: string;
  summary: string;
  status: "draft" | "review" | "scheduled" | "published";
  publish_at: string;
  unpublish_at: string;
  content_revision: number;
  unit_revision: number;
}

export interface OrganizationPersonnelRow {
  id: string;
  display_name: string;
  personnel_type: string;
  employment_position: string;
  photo_media_id: string | null;
  public_email: string;
  public_phone: string;
  show_public_email: number;
  show_public_phone: number;
  active: number;
  revision: number;
}

export interface OrganizationPositionRow {
  id: string;
  unit_content_id: string;
  title: string;
  group_label: string;
  group_sort_order: number;
  sort_order: number;
  display_style: string;
  occupant_limit: number | null;
  revision: number;
}

export interface OrganizationAssignmentRow {
  id: string;
  personnel_id: string;
  position_id: string;
  duty_detail: string;
  sort_order: number;
  starts_at: string;
  ends_at: string;
  enabled: number;
  revision: number;
}

export interface OrganizationUnitDetailRow {
  content_id: string;
  slug: string;
  title: string;
  summary: string;
  status: string;
  publish_at: string;
  unpublish_at: string;
  parent_content_id: string | null;
  unit_kind: string;
  sort_order: number;
  content_revision: number;
  unit_revision: number;
}

export type OrganizationRecordByCollection = {
  units: OrganizationUnitListRow;
  personnel: OrganizationPersonnelRow;
  positions: OrganizationPositionRow;
  assignments: OrganizationAssignmentRow;
};

export type OrganizationDetailByCollection = Omit<OrganizationRecordByCollection, "units"> & {
  units: OrganizationUnitDetailRow;
};

export type OrganizationUnitWrite = {
  slug: string;
  title: string;
  summary?: string;
  status?: "draft" | "review" | "scheduled" | "published";
  publishAt?: string;
  unpublishAt?: string;
  parentContentId?: string | null;
  unitKind: string;
  sortOrder?: number;
};

export type OrganizationPersonnelWrite = {
  displayName: string;
  personnelType?: string;
  employmentPosition?: string;
  photoMediaId?: string | null;
  publicEmail?: string;
  publicPhone?: string;
  showPublicEmail?: boolean;
  showPublicPhone?: boolean;
  active?: boolean;
};

export type OrganizationPositionWrite = {
  unitContentId: string;
  title: string;
  groupLabel?: string;
  groupSortOrder?: number;
  sortOrder?: number;
  displayStyle?: string;
  occupantLimit?: number | null;
};

export type OrganizationAssignmentWrite = {
  personnelId: string;
  positionId: string;
  dutyDetail?: string;
  sortOrder?: number;
  startsAt?: string;
  endsAt?: string;
  enabled?: boolean;
};

export type OrganizationWriteByCollection = {
  units: OrganizationUnitWrite;
  personnel: OrganizationPersonnelWrite;
  positions: OrganizationPositionWrite;
  assignments: OrganizationAssignmentWrite;
};

function collectionPath(collection: OrganizationCollection) {
  if (!ORGANIZATION_COLLECTIONS.includes(collection)) throw new TypeError("invalid organization collection");
  return `/api/admin/organization/${collection}`;
}

function entityPath(collection: OrganizationCollection, id: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) {
    throw new TypeError("invalid organization record ID");
  }
  return `${collectionPath(collection)}/${encodeURIComponent(id)}`;
}

function revisionHeaders(revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new TypeError("valid revision is required");
  return { "X-RCAT-Expected-Revision": String(revision) };
}

/** Always use the existing same-origin CMS proxy, session cookie, CSRF and password step-up layer. */
export async function getOrganizationCollection<K extends OrganizationCollection>(
  collection: K,
  limit = 100,
  offset = 0
) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new RangeError("invalid organization limit");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 999999)
    throw new RangeError("invalid organization offset");
  if (collection !== "units" && offset !== 0) throw new RangeError("offset applies to units only");
  return requestCloudflareAdmin<{
    items: OrganizationRecordByCollection[K][];
    nextOffset: number | null;
    maximumItems: number;
    generatedAt: string;
  }>(`${collectionPath(collection)}?limit=${limit}${offset ? `&offset=${offset}` : ""}`);
}

export async function getOrganizationDetail<K extends OrganizationCollection>(collection: K, id: string) {
  return requestCloudflareAdmin<{ item: OrganizationDetailByCollection[K] }>(entityPath(collection, id));
}

export async function createOrganizationRecord<K extends OrganizationCollection>(
  collection: K,
  input: OrganizationWriteByCollection[K]
) {
  return requestCloudflareAdmin<{ item: unknown }>(collectionPath(collection), {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateOrganizationRecord<K extends OrganizationCollection>(
  collection: K,
  id: string,
  revision: number,
  changes: Partial<OrganizationWriteByCollection[K]>
) {
  return requestCloudflareAdmin<{ item: unknown }>(entityPath(collection, id), {
    method: "PATCH",
    headers: revisionHeaders(revision),
    body: JSON.stringify(changes)
  });
}

export async function deleteOrganizationRecord(collection: OrganizationCollection, id: string, revision: number) {
  return requestCloudflareAdmin<{ id: string; deleted: true }>(entityPath(collection, id), {
    method: "DELETE",
    headers: revisionHeaders(revision)
  });
}
