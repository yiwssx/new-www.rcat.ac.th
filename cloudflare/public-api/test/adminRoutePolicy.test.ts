// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveAdminRoutePolicy, type AdminRoutePolicyDecision } from "../src/auth/adminRoutePolicy";

interface RouteCase {
  method: string;
  path: string;
  requirement: string | readonly string[];
}

const SUPPORTED_ADMIN_ROUTES: readonly RouteCase[] = [
  { method: "GET", path: "snapshot", requirement: "dashboard.read" },
  { method: "GET", path: "dashboard-summary", requirement: "dashboard.read" },
  { method: "GET", path: "capabilities", requirement: "dashboard.read" },
  { method: "GET", path: "content", requirement: "content.read" },
  { method: "POST", path: "content", requirement: "content.create" },
  { method: "GET", path: "content/content-1", requirement: "content.read" },
  { method: "PATCH", path: "content/content-1", requirement: "content.update" },
  { method: "DELETE", path: "content/content-1", requirement: "content.delete" },
  { method: "POST", path: "content/content-1/publish", requirement: "content.publish" },
  { method: "POST", path: "content/content-1/unpublish", requirement: "content.publish" },
  { method: "POST", path: "content/publish-pending", requirement: "content.publish" },
  { method: "GET", path: "documents", requirement: "documents.read" },
  { method: "POST", path: "documents", requirement: "documents.create" },
  { method: "GET", path: "documents/document-1", requirement: "documents.read" },
  { method: "PATCH", path: "documents/document-1", requirement: "documents.update" },
  { method: "DELETE", path: "documents/document-1", requirement: "documents.delete" },
  { method: "POST", path: "documents/document-1/publish", requirement: "documents.publish" },
  { method: "POST", path: "documents/document-1/unpublish", requirement: "documents.publish" },
  { method: "GET", path: "documents/order", requirement: "documents.read" },
  { method: "PUT", path: "documents/order", requirement: "documents.update" },
  { method: "GET", path: "media", requirement: "media.read" },
  { method: "GET", path: "media/by-ids", requirement: "media.read" },
  { method: "POST", path: "media", requirement: "media.manage" },
  { method: "DELETE", path: "media/media-1", requirement: "media.manage" },
  { method: "GET", path: "events", requirement: "events.read" },
  { method: "POST", path: "events", requirement: "events.manage" },
  { method: "PATCH", path: "events/event-1", requirement: "events.manage" },
  { method: "DELETE", path: "events/event-1", requirement: "events.manage" },
  { method: "GET", path: "carousel", requirement: "carousel.read" },
  { method: "POST", path: "carousel", requirement: "carousel.manage" },
  { method: "PATCH", path: "carousel/slide-1", requirement: "carousel.manage" },
  { method: "DELETE", path: "carousel/slide-1", requirement: "carousel.manage" },
  { method: "GET", path: "carousel/order", requirement: "carousel.read" },
  { method: "PUT", path: "carousel/order", requirement: "carousel.manage" },
  { method: "GET", path: "external-services", requirement: "external-services.read" },
  { method: "POST", path: "external-services", requirement: "external-services.manage" },
  { method: "PUT", path: "external-services", requirement: "external-services.manage" },
  { method: "PATCH", path: "external-services/service-1", requirement: "external-services.manage" },
  { method: "DELETE", path: "external-services/service-1", requirement: "external-services.manage" },
  { method: "GET", path: "external-services/order", requirement: "external-services.read" },
  { method: "PUT", path: "external-services/order", requirement: "external-services.manage" },
  { method: "GET", path: "menu", requirement: "menu.read" },
  { method: "POST", path: "menu", requirement: "menu.manage" },
  { method: "PUT", path: "menu", requirement: "menu.manage" },
  { method: "PATCH", path: "menu/menu-1", requirement: "menu.manage" },
  { method: "DELETE", path: "menu/menu-1", requirement: "menu.manage" },
  { method: "GET", path: "menu/order", requirement: "menu.read" },
  { method: "PUT", path: "menu/order", requirement: "menu.manage" },
  { method: "GET", path: "settings/site", requirement: "settings.read" },
  { method: "PUT", path: "settings/site", requirement: "settings.manage" },
  { method: "GET", path: "settings/homepage", requirement: "settings.read" },
  { method: "PUT", path: "settings/homepage", requirement: "settings.manage" },
  { method: "GET", path: "settings/display", requirement: "settings.read" },
  { method: "PUT", path: "settings/display", requirement: "settings.manage" },
  { method: "GET", path: "home-sections", requirement: "home-sections.read" },
  { method: "POST", path: "home-sections", requirement: "home-sections.manage" },
  { method: "PATCH", path: "home-sections/section-1", requirement: "home-sections.manage" },
  { method: "DELETE", path: "home-sections/section-1", requirement: "home-sections.manage" },
  { method: "GET", path: "visitor-stats/summary", requirement: "visitor-stats.read" },
  { method: "GET", path: "visitor-stats/daily", requirement: "visitor-stats.read" },
  { method: "PUT", path: "visitor-stats/daily/2026-07-22", requirement: "visitor-stats.manage" },
  { method: "DELETE", path: "visitor-stats/daily/2026-07-22", requirement: "visitor-stats.manage" },
  { method: "GET", path: "users/me", requirement: "users.read-self" },
  { method: "GET", path: "users", requirement: "users.read-all" },
  { method: "GET", path: "users/user-1", requirement: "users.read-all" },
  { method: "POST", path: "users", requirement: "users.create" },
  { method: "PATCH", path: "users/user-1", requirement: ["users.update-any", "users.update-self"] },
  { method: "DELETE", path: "users/user-1", requirement: "users.delete" },
  { method: "POST", path: "users/user-1/invitations", requirement: "users.invite" },
  { method: "DELETE", path: "users/user-1/invitations", requirement: "users.invite" },
  { method: "POST", path: "users/user-1/password-reset", requirement: "users.reset-password" },
  { method: "POST", path: "users/user-1/revoke-sessions", requirement: "users.revoke-sessions" },
  { method: "GET", path: "backup/counts", requirement: "backup.counts" },
  { method: "GET", path: "backup/download", requirement: "backup.download" },
  { method: "GET", path: "public-content-contract", requirement: "public-contracts.read" },
  { method: "GET", path: "public-document-contract", requirement: "public-contracts.read" }
];

function segments(path: string) {
  return path.split("/");
}

function requirement(decision: AdminRoutePolicyDecision) {
  if (!decision.matched) return null;
  return "capability" in decision ? decision.capability : decision.anyOf;
}

describe("Admin route policy", () => {
  it.each(SUPPORTED_ADMIN_ROUTES)("maps $method $path explicitly", ({ method, path, requirement: expected }) => {
    const decision = resolveAdminRoutePolicy(method, segments(path));
    expect(decision.matched).toBe(true);
    expect(requirement(decision)).toEqual(expected);
  });

  it("has an explicit independent inventory for all 76 supported method/path patterns", () => {
    expect(SUPPORTED_ADMIN_ROUTES).toHaveLength(76);
    expect(
      SUPPORTED_ADMIN_ROUTES.every(({ method, path }) => resolveAdminRoutePolicy(method, segments(path)).matched)
    ).toBe(true);
  });

  it.each([
    ["PUT", "content/content-1"],
    ["POST", "settings/site"],
    ["PUT", "events/event-1"],
    ["PATCH", "media/media-1"],
    ["POST", "backup/download"],
    ["PATCH", "users/user-1/invitations"],
    ["DELETE", "users/user-1/password-reset"]
  ])("rejects unsupported method %s for %s", (method, path) => {
    expect(resolveAdminRoutePolicy(method, segments(path))).toEqual({ matched: false });
  });

  it.each([
    ["GET", "unknown"],
    ["GET", "snapshot/extra"],
    ["GET", "content/content-1/extra"],
    ["GET", "c%6Fntent"],
    ["GET", "settings/s%69te"],
    ["GET", "content/%"],
    ["DELETE", "media/%2Fadmin"],
    ["POST", "users/user-1/invitations/extra"],
    ["POST", "users/user-1/password-reset/extra"],
    ["GET", "content//content-1"],
    ["GET", "content/"],
    ["POST", "auth/bootstrap-root-credential"]
  ])("fails closed for unmatched or malformed %s %s", (method, path) => {
    expect(resolveAdminRoutePolicy(method, segments(path))).toEqual({ matched: false });
  });

  it("never assigns a read-only requirement to a mutation route", () => {
    for (const route of SUPPORTED_ADMIN_ROUTES.filter(({ method }) => method !== "GET")) {
      const required = requirement(resolveAdminRoutePolicy(route.method, segments(route.path)));
      const capabilities = Array.isArray(required) ? required : [required];
      expect(capabilities.every((capability) => typeof capability === "string" && !capability.endsWith(".read"))).toBe(
        true
      );
    }
  });

  it("marks the user update requirement as contextual self-service", () => {
    expect(resolveAdminRoutePolicy("PATCH", ["users", "user-1"])).toEqual({
      matched: true,
      anyOf: ["users.update-any", "users.update-self"],
      contextualCheck: "self-user",
      resource: "admin-users"
    });
  });
});
