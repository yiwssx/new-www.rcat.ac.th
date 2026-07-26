import type { AdminCapability } from "./adminCapabilities";

export type AdminUserUpdateAuthorization =
  { capability: "users.update-any"; scope: "any" } | { capability: "users.update-self"; scope: "self" };

export type AdminRoutePolicyDecision =
  | {
      matched: true;
      capability: AdminCapability;
      resource: string;
    }
  | {
      matched: true;
      anyOf: readonly ["users.update-any", "users.update-self"];
      contextualCheck: "self-user";
      resource: "admin-users";
    }
  | { matched: false };

const UNMATCHED = Object.freeze({ matched: false } as const);
const USER_UPDATE_CAPABILITIES = Object.freeze(["users.update-any", "users.update-self"] as const);
const ADMIN_METHODS = Object.freeze(["GET", "POST", "PATCH", "PUT", "DELETE"] as const);

function requires(capability: AdminCapability, resource: string): AdminRoutePolicyDecision {
  return { matched: true, capability, resource };
}

function isExact(segments: readonly string[], ...expected: string[]) {
  return segments.length === expected.length && expected.every((segment, index) => segments[index] === segment);
}

function isDynamic(segments: readonly string[], length: number) {
  return (
    segments.length === length &&
    segments.every((segment) => {
      if (!segment) return false;

      try {
        const decoded = decodeURIComponent(segment);
        return decoded !== "." && decoded !== ".." && !/[\\/\0]/.test(decoded);
      } catch {
        return false;
      }
    })
  );
}

export function resolveAdminRoutePolicy(method: string, segments: readonly string[]): AdminRoutePolicyDecision {
  if (isExact(segments, "snapshot") && method === "GET") {
    return requires("dashboard.read", "admin-dashboard");
  }

  if (isExact(segments, "dashboard-summary") && method === "GET") {
    return requires("dashboard.read", "admin-dashboard");
  }

  if (isExact(segments, "capabilities") && method === "GET") {
    return requires("dashboard.read", "admin-capabilities");
  }

  if (segments[0] === "content") {
    if (segments.length === 1 && method === "GET") return requires("content.read", "content");
    if (segments.length === 1 && method === "POST") return requires("content.create", "content");
    if (isExact(segments, "content", "publish-pending") && method === "POST") {
      return requires("content.publish", "content-publish-queue");
    }
    if (isDynamic(segments, 2) && method === "GET") return requires("content.read", "content");
    if (isDynamic(segments, 2) && method === "PATCH") return requires("content.update", "content");
    if (isDynamic(segments, 2) && method === "DELETE") return requires("content.delete", "content");
    if (isDynamic(segments, 3) && method === "POST" && (segments[2] === "publish" || segments[2] === "unpublish")) {
      return requires("content.publish", "content");
    }
    return UNMATCHED;
  }

  if (segments[0] === "documents") {
    if (segments.length === 1 && method === "GET") return requires("documents.read", "documents");
    if (segments.length === 1 && method === "POST") return requires("documents.create", "documents");
    if (isExact(segments, "documents", "order") && method === "GET") {
      return requires("documents.read", "documents-order");
    }
    if (isExact(segments, "documents", "order") && method === "PUT") {
      return requires("documents.update", "documents-order");
    }
    if (isDynamic(segments, 2) && method === "GET") return requires("documents.read", "documents");
    if (isDynamic(segments, 2) && method === "PATCH") return requires("documents.update", "documents");
    if (isDynamic(segments, 2) && method === "DELETE") return requires("documents.delete", "documents");
    if (isDynamic(segments, 3) && method === "POST" && (segments[2] === "publish" || segments[2] === "unpublish")) {
      return requires("documents.publish", "documents");
    }
    return UNMATCHED;
  }

  if (segments[0] === "media") {
    if (segments.length === 1 && method === "GET") return requires("media.read", "media");
    if (isExact(segments, "media", "by-ids") && method === "GET") return requires("media.read", "media");
    if (segments.length === 1 && method === "POST") return requires("media.manage", "media");
    if (isDynamic(segments, 2) && method === "DELETE") return requires("media.manage", "media");
    return UNMATCHED;
  }

  if (segments[0] === "events") {
    if (segments.length === 1 && method === "GET") return requires("events.read", "events");
    if (segments.length === 1 && method === "POST") return requires("events.manage", "events");
    if (isDynamic(segments, 2) && (method === "PATCH" || method === "DELETE")) {
      return requires("events.manage", "events");
    }
    return UNMATCHED;
  }

  if (segments[0] === "carousel") {
    if (segments.length === 1 && method === "GET") return requires("carousel.read", "carousel");
    if (isExact(segments, "carousel", "order") && method === "GET") return requires("carousel.read", "carousel-order");
    if (isExact(segments, "carousel", "order") && method === "PUT") {
      return requires("carousel.manage", "carousel-order");
    }
    if (segments.length === 1 && method === "POST") return requires("carousel.manage", "carousel");
    if (isDynamic(segments, 2) && (method === "PATCH" || method === "DELETE")) {
      return requires("carousel.manage", "carousel");
    }
    return UNMATCHED;
  }

  if (segments[0] === "external-services") {
    if (segments.length === 1 && method === "GET") {
      return requires("external-services.read", "external-services");
    }
    if (isExact(segments, "external-services", "order") && method === "GET") {
      return requires("external-services.read", "external-services-order");
    }
    if (isExact(segments, "external-services", "order") && method === "PUT") {
      return requires("external-services.manage", "external-services-order");
    }
    if (segments.length === 1 && (method === "POST" || method === "PUT")) {
      return requires("external-services.manage", "external-services");
    }
    if (isDynamic(segments, 2) && (method === "PATCH" || method === "DELETE")) {
      return requires("external-services.manage", "external-services");
    }
    return UNMATCHED;
  }

  if (segments[0] === "menu") {
    if (segments.length === 1 && method === "GET") return requires("menu.read", "menu");
    if (isExact(segments, "menu", "order") && method === "GET") return requires("menu.read", "menu-order");
    if (isExact(segments, "menu", "order") && method === "PUT") return requires("menu.manage", "menu-order");
    if (segments.length === 1 && (method === "POST" || method === "PUT")) {
      return requires("menu.manage", "menu");
    }
    if (isDynamic(segments, 2) && (method === "PATCH" || method === "DELETE")) {
      return requires("menu.manage", "menu");
    }
    return UNMATCHED;
  }

  if (segments[0] === "settings") {
    if (segments.length === 2 && (segments[1] === "site" || segments[1] === "homepage" || segments[1] === "display")) {
      if (method === "GET") return requires("settings.read", "settings");
      if (method === "PUT") return requires("settings.manage", "settings");
    }
    return UNMATCHED;
  }

  if (segments[0] === "home-sections") {
    if (segments.length === 1 && method === "GET") return requires("home-sections.read", "home-sections");
    if (segments.length === 1 && method === "POST") return requires("home-sections.manage", "home-sections");
    if (isDynamic(segments, 2) && (method === "PATCH" || method === "DELETE")) {
      return requires("home-sections.manage", "home-sections");
    }
    return UNMATCHED;
  }

  if (segments[0] === "visitor-stats") {
    if (isExact(segments, "visitor-stats", "summary") && method === "GET") {
      return requires("visitor-stats.read", "visitor-stats");
    }
    if (isExact(segments, "visitor-stats", "daily") && method === "GET") {
      return requires("visitor-stats.read", "visitor-stats");
    }
    if (isDynamic(segments, 3) && segments[1] === "daily" && (method === "PUT" || method === "DELETE")) {
      return requires("visitor-stats.manage", "visitor-stats");
    }
    return UNMATCHED;
  }

  if (segments[0] === "users") {
    if (isExact(segments, "users", "me") && method === "GET") return requires("users.read-self", "admin-users");
    if (segments.length === 1 && method === "GET") return requires("users.read-all", "admin-users");
    if (segments.length === 1 && method === "POST") return requires("users.create", "admin-users");
    if (isDynamic(segments, 3) && segments[2] === "invitations" && (method === "POST" || method === "DELETE")) {
      return requires("users.invite", "admin-users");
    }
    if (isDynamic(segments, 3) && segments[2] === "password-reset" && method === "POST") {
      return requires("users.reset-password", "admin-users");
    }
    if (isDynamic(segments, 3) && segments[2] === "revoke-sessions" && method === "POST") {
      return requires("users.revoke-sessions", "admin-users");
    }
    if (isDynamic(segments, 3) && segments[2] === "mfa-requirement" && method === "POST") {
      return requires("users.mfa.require", "admin-users");
    }
    if (isDynamic(segments, 3) && segments[2] === "mfa" && method === "DELETE") {
      return requires("users.mfa.reset", "admin-users");
    }
    if (isDynamic(segments, 2) && method === "GET") return requires("users.read-all", "admin-users");
    if (isDynamic(segments, 2) && method === "PATCH") {
      return {
        matched: true,
        anyOf: USER_UPDATE_CAPABILITIES,
        contextualCheck: "self-user",
        resource: "admin-users"
      };
    }
    if (isDynamic(segments, 2) && method === "DELETE") return requires("users.delete", "admin-users");
    return UNMATCHED;
  }

  if (isExact(segments, "backup", "counts") && method === "GET") {
    return requires("backup.counts", "system-backup");
  }

  if (isExact(segments, "backup", "download") && method === "GET") {
    return requires("backup.download", "system-backup");
  }

  if (
    method === "GET" &&
    (isExact(segments, "public-content-contract") || isExact(segments, "public-document-contract"))
  ) {
    return requires("public-contracts.read", "public-contracts");
  }

  return UNMATCHED;
}

export function isSupportedAdminRoutePath(segments: readonly string[]) {
  return ADMIN_METHODS.some((method) => resolveAdminRoutePolicy(method, segments).matched);
}
