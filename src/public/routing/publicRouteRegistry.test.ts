import { describe, expect, it } from "vitest";
import {
  PUBLIC_INDEXABLE_SITEMAP_ROUTES,
  PUBLIC_MENU_ROUTE_OPTIONS,
  PUBLIC_RESERVED_ROOT_SLUGS,
  PUBLIC_ROUTE_REGISTRY,
  getPublicRouteMetadata,
  isReservedPublicRootSlug,
  validatePublicRouteRegistry
} from "./publicRouteRegistry";

describe("publicRouteRegistry", () => {
  it("keeps route metadata internally consistent", () => {
    expect(validatePublicRouteRegistry()).toEqual([]);
    expect(new Set(PUBLIC_ROUTE_REGISTRY.map((route) => route.id)).size).toBe(PUBLIC_ROUTE_REGISTRY.length);
    expect(new Set(PUBLIC_ROUTE_REGISTRY.map((route) => route.path)).size).toBe(PUBLIC_ROUTE_REGISTRY.length);
  });

  it("derives sitemap routes only from indexable entries", () => {
    expect(PUBLIC_INDEXABLE_SITEMAP_ROUTES).toContain("/ita2569");
    expect(PUBLIC_INDEXABLE_SITEMAP_ROUTES).not.toContain("/complaint");
    expect(PUBLIC_INDEXABLE_SITEMAP_ROUTES).not.toContain("/search");

    for (const path of PUBLIC_INDEXABLE_SITEMAP_ROUTES) {
      const route = getPublicRouteMetadata(path);
      expect(route?.indexable).toBe(true);
      expect(route?.sitemap).toBe(true);
    }
  });

  it("exposes only explicitly selectable routes to the menu editor", () => {
    expect(PUBLIC_MENU_ROUTE_OPTIONS.some((route) => route.path === "/complaint")).toBe(true);
    expect(PUBLIC_MENU_ROUTE_OPTIONS.some((route) => route.path === "/search")).toBe(false);
  });

  it("derives reserved roots from registered and system routes", () => {
    expect(isReservedPublicRootSlug("news")).toBe(true);
    expect(isReservedPublicRootSlug("/complaint")).toBe(true);
    expect(isReservedPublicRootSlug("admin")).toBe(true);
    expect(isReservedPublicRootSlug("organization")).toBe(true);
    expect(isReservedPublicRootSlug("content/example")).toBe(true);
    expect(isReservedPublicRootSlug("my-custom-page")).toBe(false);
    expect(PUBLIC_RESERVED_ROOT_SLUGS).toContain("ita2569");
  });
});
