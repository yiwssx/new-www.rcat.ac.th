// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vercelConfigPath = fileURLToPath(new URL("../../vercel.json", import.meta.url));
const vercelConfig = JSON.parse(readFileSync(vercelConfigPath, "utf8"));
const rewrites = vercelConfig.rewrites;
const expectedCmsRoutes = [
  ["/api/cms-auth/login", "login"],
  ["/api/cms-auth/session", "session"],
  ["/api/cms-auth/logout", "logout"],
  ["/api/cms-auth/logout-all", "logout-all"],
  ["/api/cms-auth/change-password", "change-password"],
  ["/api/cms-auth/invitation/inspect", "invitation-inspect"],
  ["/api/cms-auth/invitation/accept", "invitation-accept"],
  ["/api/cms-auth/password-reset/inspect", "password-reset-inspect"],
  ["/api/cms-auth/password-reset/complete", "password-reset-complete"]
];

describe("Vercel CMS-auth rewrite contract", () => {
  it("preserves every exact public CMS-auth URL with a unique dispatcher route", () => {
    const cmsRewrites = rewrites.filter(({ source }) => source.startsWith("/api/cms-auth/"));

    expect(cmsRewrites).toHaveLength(expectedCmsRoutes.length);
    expect(new Set(cmsRewrites.map(({ source }) => source)).size).toBe(expectedCmsRoutes.length);

    for (const [source, routeId] of expectedCmsRoutes) {
      const matches = cmsRewrites.filter((rewrite) => rewrite.source === source);
      expect(matches).toEqual([
        {
          source,
          destination: `/api/cms-auth?_rcatCmsRoute=${routeId}`
        }
      ]);

      const destination = new URL(matches[0].destination, "https://cms.example.invalid");
      expect(destination.pathname).toBe("/api/cms-auth");
      expect([...destination.searchParams.entries()]).toEqual([["_rcatCmsRoute", routeId]]);
    }

    expect(
      new Set(
        cmsRewrites.map(({ destination }) =>
          new URL(destination, "https://cms.invalid").searchParams.get("_rcatCmsRoute")
        )
      ).size
    ).toBe(expectedCmsRoutes.length);
  });

  it("places every CMS-auth rewrite before the final SPA fallback", () => {
    const spaIndex = rewrites.findIndex(({ source, destination }) => source === "/(.*)" && destination === "/");
    const cmsIndices = rewrites
      .map((rewrite, index) => ({ rewrite, index }))
      .filter(({ rewrite }) => rewrite.source.startsWith("/api/cms-auth/"))
      .map(({ index }) => index);

    expect(spaIndex).toBe(rewrites.length - 1);
    expect(cmsIndices).toHaveLength(expectedCmsRoutes.length);
    expect(cmsIndices.every((index) => index < spaIndex)).toBe(true);
  });

  it("keeps sitemap behavior unchanged", () => {
    expect(rewrites.filter(({ source }) => source === "/sitemap.xml")).toEqual([
      { source: "/sitemap.xml", destination: "/api/sitemap" }
    ]);
  });

  it("does not add rewrites for the other direct API functions", () => {
    const excludedSources = [
      "/api/admin-proxy",
      "/api/apps-script-proxy",
      "/api/admin-proxy-session/login",
      "/api/admin-proxy-session/logout"
    ];

    for (const source of excludedSources) {
      expect(rewrites.some((rewrite) => rewrite.source === source)).toBe(false);
    }
  });
});
