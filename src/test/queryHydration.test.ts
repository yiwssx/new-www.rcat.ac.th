import { describe, expect, it } from "vitest";
import { createAppQueryClient } from "../queryClient";
import { publicOrganizationDetailQueryKey } from "../features/public-organization/query";
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

  it("hydrates published organization details before the first client render", async () => {
    const slug = "rcat-2569-business";
    const key = publicOrganizationDetailQueryKey(slug);
    const publicDetail = {
      unit: { contentId: "department", slug, title: "แผนกวิชาบริหารธุรกิจ" },
      ancestors: [],
      units: [{ contentId: "department", slug, parentContentId: null, title: "แผนกวิชาบริหารธุรกิจ" }],
      positions: [{ id: "director-position", unitContentId: "department", title: "หัวหน้าแผนกวิชา", assignments: [] }],
      media: []
    };
    const serverClient = createAppQueryClient();
    serverClient.setQueryData(key, publicDetail);

    const payload = dehydrateAppQueryClient(serverClient);
    expect(
      payload.queryClientState.queries.some(
        (query) =>
          Array.isArray((query as { queryKey?: unknown }).queryKey) &&
          (query as { queryKey: string[] }).queryKey[0] === "public-organization-detail"
      )
    ).toBe(true);

    const browserClient = createAppQueryClient();
    expect(hydrateAppQueryClient(browserClient, JSON.parse(JSON.stringify(payload)))).toBe(true);
    expect(browserClient.getQueryData(key)).toEqual(publicDetail);

    let duplicateFetches = 0;
    const hydrated = await browserClient.ensureQueryData({
      queryKey: key,
      queryFn: async () => {
        duplicateFetches += 1;
        return publicDetail;
      }
    });
    expect(hydrated).toEqual(publicDetail);
    expect(duplicateFetches).toBe(0);
  });

  it("reuses QueryClient cache for identical loader keys without duplicate requests", async () => {
    const queryClient = createAppQueryClient();
    let networkRequests = 0;
    const queryOptions = {
      queryKey: ["public-shell", "router-preload-regression"],
      queryFn: async () => {
        networkRequests += 1;
        return { version: networkRequests };
      }
    };

    const first = await queryClient.ensureQueryData(queryOptions);
    const second = await queryClient.ensureQueryData(queryOptions);

    expect(first).toEqual({ version: 1 });
    expect(second).toEqual(first);
    expect(networkRequests).toBe(1);
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

  it("fails the development contract when Public query data is not JSON-serializable", () => {
    const serverClient = createAppQueryClient();
    serverClient.setQueryData(["public-shell"], {
      invalidCounter: 1n
    });

    expect(() => dehydrateAppQueryClient(serverClient)).toThrow(TypeError);
  });

  it("ignores malformed router hydration payloads", () => {
    const browserClient = createAppQueryClient();

    expect(hydrateAppQueryClient(browserClient, null)).toBe(false);
    expect(hydrateAppQueryClient(browserClient, {})).toBe(false);
    expect(browserClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
