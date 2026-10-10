import type { MediaAsset } from "../../types";
import { isValidOrganizationPublicSlug } from "../../../shared/organizationContracts";
import { isPublicReadNotFoundError } from "../public-read/errors";
import { getPublicJson, type PublicReadRequestOptions } from "../public-read/request";

export interface PublicOrganizationUnit {
  contentId: string;
  parentContentId: string | null;
  unitKind: string;
  sortOrder: number;
  slug: string;
  title: string;
  summary: string;
  depth: number;
}
export interface PublicOrganizationPerson {
  id: string;
  displayName: string;
  personnelType: string;
  employmentPosition: string;
  photoMediaId: string | null;
  publicEmail: string;
  publicPhone: string;
}
export interface PublicOrganizationAssignment {
  id: string;
  dutyDetail: string;
  sortOrder: number;
  person: PublicOrganizationPerson;
}
export interface PublicOrganizationPosition {
  id: string;
  unitContentId: string;
  title: string;
  groupLabel: string;
  groupSortOrder: number;
  sortOrder: number;
  displayStyle: string;
  assignments: PublicOrganizationAssignment[];
}
export interface PublicOrganizationDetail {
  unit: PublicOrganizationUnit;
  ancestors: PublicOrganizationUnit[];
  units: PublicOrganizationUnit[];
  positions: PublicOrganizationPosition[];
  media: MediaAsset[];
}

export async function getPublicOrganizationDetail(slug: string, options: PublicReadRequestOptions = {}) {
  if (!isValidOrganizationPublicSlug(slug)) return null;
  try {
    const payload = await getPublicJson(
      `/api/public/organization/${encodeURIComponent(slug)}`,
      "organization-detail",
      options
    );
    if (
      !payload.unit ||
      typeof payload.unit !== "object" ||
      Array.isArray(payload.unit) ||
      !Array.isArray(payload.ancestors) ||
      !Array.isArray(payload.units) ||
      !Array.isArray(payload.positions) ||
      !Array.isArray(payload.media)
    ) {
      throw new TypeError("invalid organization detail response");
    }
    return payload as unknown as PublicOrganizationDetail;
  } catch (error) {
    if (isPublicReadNotFoundError(error)) return null;
    throw error;
  }
}
