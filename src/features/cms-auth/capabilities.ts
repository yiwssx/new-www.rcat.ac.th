import { isCmsRole, type CmsRole } from "./types";

export const CMS_CAPABILITIES = Object.freeze([
  "dashboard.read",
  "content.read",
  "content.create",
  "content.update",
  "content.delete",
  "content.publish",
  "documents.read",
  "documents.create",
  "documents.update",
  "documents.delete",
  "documents.publish",
  "media.read",
  "media.manage",
  "events.read",
  "events.manage",
  "carousel.read",
  "carousel.manage",
  "external-services.read",
  "external-services.manage",
  "menu.read",
  "menu.manage",
  "settings.read",
  "settings.manage",
  "home-sections.read",
  "home-sections.manage",
  "visitor-stats.read",
  "visitor-stats.manage",
  "users.read-self",
  "users.read-all",
  "users.create",
  "users.update-self",
  "users.update-any",
  "users.delete",
  "users.invite",
  "users.reset-password",
  "users.revoke-sessions",
  "users.mfa.require",
  "users.mfa.reset",
  "backup.counts",
  "backup.download",
  "auth.bootstrap-root-credential",
  "auth.change-password-self",
  "auth.reauthenticate-self",
  "auth.mfa.manage-self",
  "public-contracts.read"
] as const);

export type CmsCapability = (typeof CMS_CAPABILITIES)[number];

const CAPABILITY_SET = new Set<string>(CMS_CAPABILITIES);

export interface CmsCapabilityPayload {
  role: CmsRole;
  capabilities: CmsCapability[];
}

export function isCmsCapability(value: unknown): value is CmsCapability {
  return typeof value === "string" && CAPABILITY_SET.has(value);
}

export function parseCmsCapabilityPayload(value: unknown): CmsCapabilityPayload {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("role" in value) ||
    !("capabilities" in value) ||
    !isCmsRole(value.role) ||
    !Array.isArray(value.capabilities)
  ) {
    throw new TypeError("CMS capability payload is invalid");
  }

  const capabilities = value.capabilities;

  if (!capabilities.every(isCmsCapability) || new Set(capabilities).size !== capabilities.length) {
    throw new TypeError("CMS capability payload is invalid");
  }

  return {
    role: value.role,
    capabilities: [...capabilities].sort()
  };
}

export function hasCmsCapability(
  capabilities: readonly CmsCapability[] | ReadonlySet<CmsCapability> | null | undefined,
  capability: CmsCapability
) {
  if (!capabilities) {
    return false;
  }

  return Array.isArray(capabilities)
    ? capabilities.includes(capability)
    : (capabilities as ReadonlySet<CmsCapability>).has(capability);
}

export function hasAnyCmsCapability(
  capabilities: readonly CmsCapability[] | ReadonlySet<CmsCapability> | null | undefined,
  required: readonly CmsCapability[]
) {
  return required.length > 0 && required.some((capability) => hasCmsCapability(capabilities, capability));
}
