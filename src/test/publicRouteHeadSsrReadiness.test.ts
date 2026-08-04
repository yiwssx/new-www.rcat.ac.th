import { describe, expect, it } from "vitest";
import indexHtmlSource from "../../index.html?raw";
import clientEntrySource from "../entry-client.tsx?raw";
import mainSource from "../main.tsx?raw";
import routeComponentsSource from "../routeComponents.tsx?raw";
import routesSource from "../routes.tsx?raw";
import serverEntrySource from "../entry-server.tsx?raw";

describe("public route head SSR readiness", () => {
  it("renders TanStack Router head content at the root layout", () => {
    expect(routeComponentsSource).toContain("HeadContent");
    expect(routeComponentsSource).toContain("<HeadContent />");
  });

  it("owns public canonical metadata in route head declarations", () => {
    expect(routesSource).toContain("head: getRootRouteHead");
    expect(routesSource).toContain('head: ({ match }) => getStaticPublicRouteHead("/news", match.search)');
    expect(routesSource).toContain('head: ({ match }) => getStaticPublicRouteHead("/announcements", match.search)');
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
    expect(clientEntrySource).not.toContain("document.title =");
  });

  it("enables Phase 3 Query hydration while preserving the empty-root CSR fallback", () => {
    expect(routesSource).toContain("dehydrate: () => dehydrateAppQueryClient(queryClient)");
    expect(routesSource).toContain("hydrateAppQueryClient(queryClient, dehydrated)");
    expect(clientEntrySource).toContain("hydrateRoot(");
    expect(clientEntrySource).toContain("<RouterClient router={runtime.router} />");
    expect(clientEntrySource).toContain("createRoot(rootElement).render(");
    expect(serverEntrySource).toContain("renderRouterToString");
    expect(serverEntrySource).toContain("request: handlerRequest");
  });
});
