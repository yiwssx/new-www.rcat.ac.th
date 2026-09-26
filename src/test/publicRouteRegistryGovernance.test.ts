import { describe, expect, it } from "vitest";
import menuPageSource from "../admin/pages/MenuPage.tsx?raw";
import routeHeadSource from "../public/routing/publicRouteHeadImpl.ts?raw";
import routesSource from "../routes.tsx?raw";
import sitemapSource from "../../api/sitemap.mjs?raw";
import workerRouterSource from "../../cloudflare/public-api/src/router.ts?raw";

describe("public route registry governance", () => {
  it("keeps application route SEO on the registry-backed static head path", () => {
    expect(routesSource).not.toContain("buildPublicRouteHead");
    expect(routesSource).toContain('getStaticPublicRouteHead("/complaint")');
    expect(routesSource).toContain('getStaticPublicRouteHead("/ita2569")');
    expect(routeHeadSource).toContain("PUBLIC_ROUTE_REGISTRY.map");
    expect(routeHeadSource).toContain("getPublicRouteMetadata(pathname)");
  });

  it("derives sitemap static routes from the shared registry", () => {
    expect(sitemapSource).toContain('from "../config/public-routes.json"');
    expect(sitemapSource).toContain("route?.indexable === true && route?.sitemap === true");
    expect(sitemapSource).not.toMatch(/STATIC_INDEXABLE_ROUTES\s*=\s*\[/);
  });

  it("exposes registered routes to the menu editor without replacing manual href entry", () => {
    expect(menuPageSource).toContain("PUBLIC_MENU_ROUTE_OPTIONS");
    expect(menuPageSource).toContain("หน้าในระบบ");
    expect(menuPageSource).toContain('label="เส้นทางหรือ URL"');
    expect(menuPageSource).toContain("กำหนด URL เอง");
  });

  it("enforces reserved route slugs before canonical content mutation handlers", () => {
    const guardIndex = workerRouterSource.indexOf("enforceReservedContentSlug(request, env)");
    const editorialIndex = workerRouterSource.indexOf("handleAdminEditorialGovernance(request, env)");
    const governanceIndex = workerRouterSource.indexOf("handleAdminContentGovernance(request, env)");
    const adminWriteIndex = workerRouterSource.indexOf("adminWrite(request, env)");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(editorialIndex).toBeGreaterThan(guardIndex);
    expect(governanceIndex).toBeGreaterThan(guardIndex);
    expect(adminWriteIndex).toBeGreaterThan(guardIndex);
  });
});
