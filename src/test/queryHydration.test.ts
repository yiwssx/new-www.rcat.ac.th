import { describe, expect, it } from "vitest";
import { createAppQueryClient } from "../queryClient";
import { dehydrateAppQueryClient, hydrateAppQueryClient } from "../queryHydration";

describe("SSR query hydration", () => {
  it("round-trips successful Public query data into a new QueryClient", () => {
    const serverClient = createAppQueryClient();
    serverClient.setQueryData(["public-shell"], {
      siteSettings: { siteName: "RCAT" },
      menu: []
    });

    const dehydrated = dehydrateAppQueryClient(serverClient);
    const browserClient = createAppQueryClient();

    expect(hydrateAppQueryClient(browserClient, dehydrated)).toBe(true);
    expect(browserClient.getQueryData(["public-shell"])).toEqual({
      siteSettings: { siteName: "RCAT" },
      menu: []
    });
  });

  it("does not serialize query roots outside the Public SSR allowlist", () => {
    const serverClient = createAppQueryClient();
    serverClient.setQueryData(["public-shell"], { safe: true });
    serverClient.setQueryData(["admin-private-query"], { secret: "must-not-cross-ssr-boundary" });

    const dehydrated = dehydrateAppQueryClient(serverClient);
    const serialized = JSON.stringify(dehydrated);

    expect(serialized).toContain("public-shell");
    expect(serialized).not.toContain("admin-private-query");
    expect(serialized).not.toContain("must-not-cross-ssr-boundary");
  });

  it("ignores malformed router hydration payloads", () => {
    const browserClient = createAppQueryClient();

    expect(hydrateAppQueryClient(browserClient, null)).toBe(false);
    expect(hydrateAppQueryClient(browserClient, {})).toBe(false);
    expect(browserClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
