export const CMS_ROLES = ["admin", "editor", "viewer"] as const;

export type CmsRole = (typeof CMS_ROLES)[number];

export interface CmsSafeUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: CmsRole;
  isRoot: boolean;
  recentPasswordAuthentication: boolean;
  recentMfaAuthentication: boolean;
}

export interface CmsSession {
  user: CmsSafeUser;
  capabilities: readonly import("./capabilities").CmsCapability[];
}

export type CmsAuthStatus = "bootstrapping" | "authenticated" | "unauthenticated" | "unavailable";
export type CmsAssurance = "password" | "mfa";
export type CmsMfaProof = { totpCode: string; recoveryCode?: never } | { recoveryCode: string; totpCode?: never };

export type CmsLoginResult =
  { kind: "authenticated"; user: CmsSafeUser } | { kind: "challenge"; mfaRequired: true; enrollmentRequired: boolean };

export interface CmsMfaSetup {
  manualEntryKey: string;
  otpAuthUri: string;
  expiresAt: string;
}

export interface CmsRecoveryCodesResult {
  recoveryCodes: string[];
  loginRequired: boolean;
}

export interface CmsInvitationInspection {
  valid: true;
  user: {
    email: string;
    name: string;
    role: CmsRole;
    username: string | null;
  };
  expiresAt: string;
}

export interface CmsPasswordResetInspection {
  valid: true;
  user: {
    emailHint: string;
  };
  expiresAt: string;
}

const SAFE_USER_KEYS = new Set([
  "id",
  "email",
  "name",
  "username",
  "role",
  "isRoot",
  "recentPasswordAuthentication",
  "recentMfaAuthentication"
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCmsRole(value: unknown): value is CmsRole {
  return typeof value === "string" && (CMS_ROLES as readonly string[]).includes(value);
}

export function parseCmsSafeUser(value: unknown): CmsSafeUser {
  if (!isObject(value) || Object.keys(value).some((key) => !SAFE_USER_KEYS.has(key))) {
    throw new TypeError("CMS user payload is invalid");
  }

  if (
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.email !== "string" ||
    !value.email ||
    typeof value.name !== "string" ||
    !value.name ||
    !(typeof value.username === "string" || value.username === null) ||
    !isCmsRole(value.role) ||
    typeof value.isRoot !== "boolean" ||
    typeof value.recentPasswordAuthentication !== "boolean" ||
    typeof value.recentMfaAuthentication !== "boolean"
  ) {
    throw new TypeError("CMS user payload is invalid");
  }

  return {
    id: value.id,
    email: value.email,
    name: value.name,
    username: value.username,
    role: value.role,
    isRoot: value.isRoot,
    recentPasswordAuthentication: value.recentPasswordAuthentication,
    recentMfaAuthentication: value.recentMfaAuthentication
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}
