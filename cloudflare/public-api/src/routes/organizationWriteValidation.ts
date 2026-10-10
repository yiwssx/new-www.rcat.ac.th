import { isValidOrganizationAssignmentPeriod } from "../../../../shared/organizationContracts";

/**
 * Trusted Worker boundary for Organization Chart mutation payloads.
 * Neither IDs of newly created records nor revisions, timestamps, actor
 * identities or content publication fields can be supplied through these DTOs.
 */
export class OrganizationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationInputError";
  }
}

type InputRecord = Record<string, unknown>;

function asRecord(value: unknown): InputRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganizationInputError("request body must be an object");
  }
  return value as InputRecord;
}

function allowOnly(input: InputRecord, allowed: readonly string[]) {
  const fields = new Set(allowed);
  const unexpected = Object.keys(input).find((key) => !fields.has(key));
  if (unexpected) {
    throw new OrganizationInputError(`unknown or protected field: ${unexpected}`);
  }
}

function text(input: InputRecord, key: string, maximum: number, required = false) {
  const value = input[key];
  if (value === undefined && !required) return "";
  if (typeof value !== "string") throw new OrganizationInputError(`invalid ${key}`);
  const normalized = value.trim();
  if (normalized.length > maximum || (required && normalized.length === 0)) {
    throw new OrganizationInputError(`invalid ${key}`);
  }
  return normalized;
}

function optionalId(input: InputRecord, key: string): string | null {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || raw.length > 128 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(raw)) {
    throw new OrganizationInputError(`invalid ${key}`);
  }
  return raw;
}

function requiredId(input: InputRecord, key: string) {
  const id = optionalId(input, key);
  if (!id) throw new OrganizationInputError(`missing ${key}`);
  return id;
}

function integer(input: InputRecord, key: string, fallback: number, minimum = 0, maximum = 1000000) {
  const value = input[key] === undefined ? fallback : input[key];
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new OrganizationInputError(`invalid ${key}`);
  }
  return value as number;
}

function flag(input: InputRecord, key: string, fallback: boolean) {
  const value = input[key] === undefined ? fallback : input[key];
  if (typeof value !== "boolean") throw new OrganizationInputError(`invalid ${key}`);
  return value;
}

export interface OrganizationUnitWriteInput {
  parentContentId: string | null;
  unitKind: string;
  sortOrder: number;
}

export function parseOrganizationUnitWrite(value: unknown): OrganizationUnitWriteInput {
  const input = asRecord(value);
  allowOnly(input, ["parentContentId", "unitKind", "sortOrder"]);
  const unitKind = text(input, "unitKind", 64, true);
  if (!/^[a-z][a-z0-9-]*$/.test(unitKind)) throw new OrganizationInputError("invalid unitKind");

  return {
    parentContentId: optionalId(input, "parentContentId"),
    unitKind,
    sortOrder: integer(input, "sortOrder", 0)
  };
}

export interface PersonnelWriteInput {
  displayName: string;
  personnelType: string;
  employmentPosition: string;
  photoMediaId: string | null;
  publicEmail: string;
  publicPhone: string;
  showPublicEmail: boolean;
  showPublicPhone: boolean;
  active: boolean;
}

export function parsePersonnelWrite(value: unknown): PersonnelWriteInput {
  const input = asRecord(value);
  allowOnly(input, [
    "displayName",
    "personnelType",
    "employmentPosition",
    "photoMediaId",
    "publicEmail",
    "publicPhone",
    "showPublicEmail",
    "showPublicPhone",
    "active"
  ]);
  const publicEmail = text(input, "publicEmail", 254);
  if (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail)) {
    throw new OrganizationInputError("invalid publicEmail");
  }

  return {
    displayName: text(input, "displayName", 200, true),
    personnelType: text(input, "personnelType", 120),
    employmentPosition: text(input, "employmentPosition", 200),
    photoMediaId: optionalId(input, "photoMediaId"),
    publicEmail,
    publicPhone: text(input, "publicPhone", 40),
    showPublicEmail: flag(input, "showPublicEmail", false),
    showPublicPhone: flag(input, "showPublicPhone", false),
    active: flag(input, "active", true)
  };
}

export interface OrganizationPositionWriteInput {
  unitContentId: string;
  title: string;
  groupLabel: string;
  groupSortOrder: number;
  sortOrder: number;
  displayStyle: string;
  occupantLimit: number | null;
}

export function parseOrganizationPositionWrite(value: unknown): OrganizationPositionWriteInput {
  const input = asRecord(value);
  allowOnly(input, [
    "unitContentId",
    "title",
    "groupLabel",
    "groupSortOrder",
    "sortOrder",
    "displayStyle",
    "occupantLimit"
  ]);
  const occupantLimit = input.occupantLimit;
  let maxOccupants: number | null = null;
  if (occupantLimit !== undefined && occupantLimit !== null) {
    maxOccupants = integer(input, "occupantLimit", 1, 1, 500);
  }

  return {
    unitContentId: requiredId(input, "unitContentId"),
    title: text(input, "title", 200, true),
    groupLabel: text(input, "groupLabel", 160),
    groupSortOrder: integer(input, "groupSortOrder", 0),
    sortOrder: integer(input, "sortOrder", 0),
    displayStyle: text(input, "displayStyle", 64) || "default",
    occupantLimit: maxOccupants
  };
}

export interface OrganizationAssignmentWriteInput {
  personnelId: string;
  positionId: string;
  dutyDetail: string;
  sortOrder: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
}

export function parseOrganizationAssignmentWrite(value: unknown): OrganizationAssignmentWriteInput {
  const input = asRecord(value);
  allowOnly(input, ["personnelId", "positionId", "dutyDetail", "sortOrder", "startsAt", "endsAt", "enabled"]);
  const startsAt = text(input, "startsAt", 24);
  const endsAt = text(input, "endsAt", 24);
  if (!isValidOrganizationAssignmentPeriod(startsAt, endsAt)) {
    throw new OrganizationInputError("invalid assignment period");
  }

  return {
    personnelId: requiredId(input, "personnelId"),
    positionId: requiredId(input, "positionId"),
    dutyDetail: text(input, "dutyDetail", 1200),
    sortOrder: integer(input, "sortOrder", 0),
    startsAt,
    endsAt,
    enabled: flag(input, "enabled", true)
  };
}
