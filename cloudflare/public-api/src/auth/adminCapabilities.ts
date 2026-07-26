import type { AdminIdentity, AdminRole } from "./adminAccess";
import { jsonError } from "../responses";

export const ADMIN_CAPABILITIES = Object.freeze([
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
  "auth.change-password-self",
  "auth.reauthenticate-self",
  "auth.mfa.manage-self",
  "public-contracts.read"
] as const);

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const EDITOR_CAPABILITIES = Object.freeze([
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
  "menu.read",
  "settings.read",
  "home-sections.read",
  "visitor-stats.read",
  "users.read-self",
  "users.update-self",
  "auth.change-password-self",
  "auth.reauthenticate-self",
  "auth.mfa.manage-self",
  "public-contracts.read"
] as const satisfies readonly AdminCapability[]);

const VIEWER_CAPABILITIES = Object.freeze([
  "dashboard.read",
  "content.read",
  "documents.read",
  "media.read",
  "events.read",
  "carousel.read",
  "external-services.read",
  "menu.read",
  "settings.read",
  "home-sections.read",
  "visitor-stats.read",
  "users.read-self",
  "auth.change-password-self",
  "auth.reauthenticate-self",
  "auth.mfa.manage-self",
  "public-contracts.read"
] as const satisfies readonly AdminCapability[]);

export const ROLE_CAPABILITIES = Object.freeze({
  admin: ADMIN_CAPABILITIES,
  editor: EDITOR_CAPABILITIES,
  viewer: VIEWER_CAPABILITIES
} as const satisfies Readonly<Record<AdminRole, readonly AdminCapability[]>>);

const EMPTY_CAPABILITIES = Object.freeze([]) as readonly AdminCapability[];
const KNOWN_CAPABILITIES = new Set<string>(ADMIN_CAPABILITIES);

function isAdminRole(value: unknown): value is AdminRole {
  return value === "admin" || value === "editor" || value === "viewer";
}

function getRole(value: AdminIdentity | AdminRole | unknown) {
  if (typeof value === "object" && value !== null && "role" in value) {
    return (value as { role?: unknown }).role;
  }

  return value;
}

function isKnownCapability(value: unknown): value is AdminCapability {
  return typeof value === "string" && KNOWN_CAPABILITIES.has(value);
}

export function getCapabilitiesForRole(role: unknown): readonly AdminCapability[] {
  if (!isAdminRole(role)) {
    return EMPTY_CAPABILITIES;
  }

  return Object.freeze([...ROLE_CAPABILITIES[role]]);
}

export function hasAdminCapability(
  identityOrRole: AdminIdentity | AdminRole | unknown,
  capability: AdminCapability | unknown
) {
  const role = getRole(identityOrRole);
  return (
    isAdminRole(role) &&
    isKnownCapability(capability) &&
    (ROLE_CAPABILITIES[role] as readonly AdminCapability[]).includes(capability)
  );
}

export function hasAnyAdminCapability(
  identityOrRole: AdminIdentity | AdminRole | unknown,
  capabilities: readonly (AdminCapability | unknown)[]
) {
  return capabilities.length > 0 && capabilities.some((capability) => hasAdminCapability(identityOrRole, capability));
}

export interface AdminCapabilityRequirementOptions {
  resource?: string;
}

function missingPermission(options: AdminCapabilityRequirementOptions = {}) {
  const response = jsonError("required permission is missing", 403, {
    resource: options.resource || "admin-structured-data"
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function requireAdminCapability(
  identity: AdminIdentity,
  capability: AdminCapability,
  options: AdminCapabilityRequirementOptions = {}
) {
  return hasAdminCapability(identity, capability) ? null : missingPermission(options);
}

export function requireAnyAdminCapability(
  identity: AdminIdentity,
  capabilities: readonly AdminCapability[],
  options: AdminCapabilityRequirementOptions = {}
) {
  return hasAnyAdminCapability(identity, capabilities) ? null : missingPermission(options);
}
