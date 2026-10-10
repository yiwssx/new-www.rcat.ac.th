import type {
  OrganizationAssignment,
  OrganizationPerson,
  OrganizationPosition,
  OrganizationUnit
} from "../../../../shared/organizationContracts";

// D1 row contracts deliberately stay separate from the browser/CMS account model.
export interface OrganizationUnitRow {
  content_id: OrganizationUnit["contentId"];
  parent_content_id: OrganizationUnit["parentContentId"];
  unit_kind: string;
  sort_order: number;
  settings_json: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export const ORGANIZATION_UNIT_ROW_COLUMNS = [
  "content_id",
  "parent_content_id",
  "unit_kind",
  "sort_order",
  "settings_json",
  "revision",
  "created_at",
  "updated_at"
] as const satisfies readonly (keyof OrganizationUnitRow)[];

export interface PersonnelRow {
  id: OrganizationPerson["id"];
  display_name: OrganizationPerson["displayName"];
  personnel_type: string;
  employment_position: string;
  photo_media_id: string | null;
  public_email: string;
  public_phone: string;
  show_public_email: 0 | 1;
  show_public_phone: 0 | 1;
  active: 0 | 1;
  revision: number;
  created_at: string;
  updated_at: string;
}

export const PERSONNEL_ROW_COLUMNS = [
  "id",
  "display_name",
  "personnel_type",
  "employment_position",
  "photo_media_id",
  "public_email",
  "public_phone",
  "show_public_email",
  "show_public_phone",
  "active",
  "revision",
  "created_at",
  "updated_at"
] as const satisfies readonly (keyof PersonnelRow)[];

export interface OrganizationPositionRow {
  id: OrganizationPosition["id"];
  unit_content_id: OrganizationPosition["unitContentId"];
  title: string;
  group_label: string;
  group_sort_order: number;
  sort_order: number;
  display_style: string;
  occupant_limit: number | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export const ORGANIZATION_POSITION_ROW_COLUMNS = [
  "id",
  "unit_content_id",
  "title",
  "group_label",
  "group_sort_order",
  "sort_order",
  "display_style",
  "occupant_limit",
  "revision",
  "created_at",
  "updated_at"
] as const satisfies readonly (keyof OrganizationPositionRow)[];

export interface OrganizationAssignmentRow {
  id: OrganizationAssignment["id"];
  personnel_id: OrganizationAssignment["personnelId"];
  position_id: OrganizationAssignment["positionId"];
  duty_detail: string;
  sort_order: number;
  enabled: 0 | 1;
  revision: number;
  created_at: string;
  updated_at: string;
}

export const ORGANIZATION_ASSIGNMENT_ROW_COLUMNS = [
  "id",
  "personnel_id",
  "position_id",
  "duty_detail",
  "sort_order",
  "enabled",
  "revision",
  "created_at",
  "updated_at"
] as const satisfies readonly (keyof OrganizationAssignmentRow)[];
