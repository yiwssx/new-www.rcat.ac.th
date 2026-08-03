import { describe, expect, it } from "vitest";
import indexHtmlSource from "../../index.html?raw";
import mainSource from "../main.tsx?raw";
import routeComponentsSource from "../routeComponents.tsx?raw";
import routesSource from "../routes.tsx?raw";

describe("public route head SSR readiness", () => {
  it("renders TanStack Router head content at the root layout", () => {
    expect(routeComponentsSource).toContain("HeadContent");
    expect(routeComponentsSource).toContain("<HeadContent />");
  });

  it("owns public canonical metadata in route head declarations", () => {
    expect(routesSource).toContain('head: () => getStaticPublicRouteHead("/news")');
    expect(routesSource).toContain('head: () => getStaticPublicRouteHead("/search")');
    expect(routesSource).toContain("head: ({ params }) => getPublicContentRouteHead(params.slug)");
    expect(routesSource).toContain("head: getCmsRouteHead");
  });

  it("does not leave competing title or description ownership in the Vite HTML template", () => {
    expect(indexHtmlSource).not.toMatch(/<title[>\s]/i);
    expect(indexHtmlSource).not.toMatch(/<meta\s+name=["']description["']/i);
  });

  it("does not imperatively assign document.title during browser bootstrap", () => {
    expect(mainSource).not.toContain("document.title =");
  });

  it("keeps Step 7 free of route data loaders and SSR activation", () => {
    expect(routesSource).not.toContain("loader:");
    expect(mainSource).toContain("ReactDOM.createRoot");
    expect(mainSource).not.toContain("hydrateRoot");
  });
});
