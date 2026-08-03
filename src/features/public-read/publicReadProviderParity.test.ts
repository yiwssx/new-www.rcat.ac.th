import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicContentListSnapshot, getContentDetail } from "../public-content/api";
import { getPublicHomeSnapshot } from "../public-home/api";
import { getPublicProgramListSnapshot } from "../public-programs/api";
import { getPublicSearchIndexSnapshot } from "../public-search/api";
import { getPublicCmsSnapshotForProvider } from "../../public/hooks/usePublicCmsSnapshot";
import { recordContentView, recordPresence, recordSiteView } from "../site-view/api";
import { resetCloudflarePublicApiBackoffForTests } from "./cloudflareApi";
import { projectSettings } from "../../config/projectSettings";
import { formatDisplayDate } from "../../utils/dateDisplay";

const generatedAt = "2026-06-20T00:00:00.000Z";
const publicItem = {
  id: "sample-news-001",
  title: "Sample public news",
  slug: "sample-news",
  type: "news",
  status: "published",
  owner: "",
  summary: "Sanitized summary",
  updatedAt: generatedAt,
  publishAt: generatedAt
};
const sharedMetadata = {
  siteSettings: {},
  homepageSettings: {},
  displaySettings: {
    dateFormat: "D MMMM YYYY",
    timeMode: "24h"
  },
  menu: [],
  generatedAt
};
const homeSnapshot = {
  ...sharedMetadata,
  carouselSlides: [],
  externalServices: [],
  visitorStats: {},
  latestNews: [publicItem],
  latestAnnouncements: [],
  procurementItems: [],
  jobOpportunityItems: [],
  achievementItems: [],
  programItems: [],
  documentItems: [],
  eventItems: [],
  media: []
};
const contentSnapshot = {
  ...sharedMetadata,
  kind: "news",
  items: [publicItem],
  pageItems: [],
  media: []
};
const programSnapshot = {
  ...sharedMetadata,
  items: [],
  media: []
};
const searchSnapshot = {
  ...sharedMetadata,
  query: "",
  items: [publicItem]
};

function installCloudflareFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const payloadByPath: Record<string, unknown> = {
      "/api/public/home": homeSnapshot,
      "/api/public/content": contentSnapshot,
      "/api/public/content/sample-news": {
        item: publicItem,
        media: [],
        generatedAt
      },
      "/api/public/programs": programSnapshot,
      "/api/public/search": searchSnapshot
    };
    const payload = payloadByPath[url.pathname];

    if (!payload) {
      if (url.pathname === "/api/public/site-view" || url.pathname === "/api/public/presence") {
        return new Response(JSON.stringify({ recorded: true, day: "2026-06-20", onlineUsers: 2 }), {
          status: url.pathname === "/api/public/site-view" ? 201 : 200,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }

      if (url.pathname === "/api/public/content-view") {
        return new Response(
          JSON.stringify({
            id: "sample-news-001",
            slug: "sample-news",
            viewCount: 8,
            lastViewedAt: generatedAt
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "");
  vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
  resetCloudflarePublicApiBackoffForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("M20 public read provider parity", () => {
  it("uses Cloudflare for every migrated public structured read", async () => {
    const fetchMock = installCloudflareFetch();

    await expect(getPublicHomeSnapshot()).resolves.toEqual(homeSnapshot);
    await expect(getPublicContentListSnapshot("news")).resolves.toEqual(contentSnapshot);
    await expect(getContentDetail({ slug: "sample-news" })).resolves.toEqual(publicItem);
    await expect(getPublicProgramListSnapshot()).resolves.toEqual(programSnapshot);
    await expect(getPublicSearchIndexSnapshot()).resolves.toEqual(searchSnapshot);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(JSON.parse(window.localStorage.getItem(projectSettings.storageKeys.displaySettings) || "{}")).toEqual(
      sharedMetadata.displaySettings
    );
    expect(formatDisplayDate(generatedAt)).toBe("20 มิถุนายน 2569");
  });

  it("builds the Contact/public shell snapshot from Cloudflare without calling Apps Script", async () => {
    const fetchMock = installCloudflareFetch();

    await expect(getPublicCmsSnapshotForProvider()).resolves.toMatchObject({
      siteSettings: homeSnapshot.siteSettings,
      homepageSettings: homeSnapshot.homepageSettings,
      content: [publicItem]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("records Cloudflare site views without calling Apps Script", () => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    const fetchMock = installCloudflareFetch();
    const input = {
      visitorId: "rcat_abcdefghijkl",
      path: "/news",
      timestamp: "2026-06-22T00:00:00.000Z"
    };

    expect(recordSiteView(input)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/site-view",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input)
      })
    );
  });

  it("treats public analytics as Cloudflare-only and no-ops when the provider is not Cloudflare", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = installCloudflareFetch();
    const input = {
      visitorId: "rcat_abcdefghijkl",
      path: "/news",
      timestamp: "2026-06-22T00:00:00.000Z"
    };

    expect(recordSiteView(input)).toBe(false);
    expect(recordPresence(input)).toBe(false);
    await expect(recordContentView({ slug: "sample-news" })).rejects.toThrow(
      "Public content-view analytics is Cloudflare-only"
    );

    expect(warnSpy).toHaveBeenNthCalledWith(
      1,
      "Public site-view analytics is Cloudflare-only in M20 and is disabled for the current provider."
    );
    expect(warnSpy).toHaveBeenNthCalledWith(
      2,
      "Public presence analytics is Cloudflare-only in M20 and is disabled for the current provider."
    );
    expect(warnSpy).toHaveBeenNthCalledWith(
      3,
      "Public content-view analytics is Cloudflare-only in M20 and is disabled for the current provider."
    );
    expect(fetchMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("backs off Cloudflare presence writes after the preview presence schema is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "visitor presence schema is not available",
            diagnostic: "visitor-presence-schema-missing-v1",
            suggestedMigration: "run 0006_m20_visitor_presence.sql"
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" }
          }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      visitorId: "rcat_abcdefghijkl",
      path: "/news"
    };

    expect(recordPresence(input)).toBe(true);
    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(recordPresence(input)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "Public presence tracking is temporarily disabled. run 0006_m20_visitor_presence.sql"
    );
    warnSpy.mockRestore();
  });

  it("records Cloudflare presence and content views when explicitly selected", async () => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    const fetchMock = installCloudflareFetch();

    expect(recordPresence({ visitorId: "rcat_abcdefghijkl", path: "/news" })).toBe(true);
    await expect(recordContentView({ slug: "sample-news" })).resolves.toMatchObject({
      slug: "sample-news",
      viewCount: 8
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/presence",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/content-view",
      expect.objectContaining({ method: "POST" })
    );
  });
});
