import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appsScriptMocks = vi.hoisted(() => ({
  getCmsSnapshot: vi.fn(),
  getContentDetail: vi.fn(),
  getPublicContentListSnapshot: vi.fn(),
  getPublicHomeSnapshot: vi.fn(),
  getPublicProgramListSnapshot: vi.fn(),
  getPublicSearchIndexSnapshot: vi.fn()
}));

vi.mock("../../services/googleApi", () => appsScriptMocks);

import { getPublicContentListSnapshot, getContentDetail } from "../public-content/api";
import { getPublicHomeSnapshot } from "../public-home/api";
import { getPublicProgramListSnapshot } from "../public-programs/api";
import { getPublicSearchIndexSnapshot } from "../public-search/api";
import { getPublicCmsSnapshotForProvider } from "../../public/hooks/usePublicCmsSnapshot";

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
        generatedAt
      },
      "/api/public/programs": programSnapshot,
      "/api/public/search": searchSnapshot
    };
    const payload = payloadByPath[url.pathname];

    if (!payload) {
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
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("M19 public read provider parity", () => {
  it("keeps every migrated public read on Apps Script by default", async () => {
    appsScriptMocks.getPublicHomeSnapshot.mockResolvedValue(homeSnapshot);
    appsScriptMocks.getPublicContentListSnapshot.mockResolvedValue(contentSnapshot);
    appsScriptMocks.getContentDetail.mockResolvedValue(publicItem);
    appsScriptMocks.getPublicProgramListSnapshot.mockResolvedValue(programSnapshot);
    appsScriptMocks.getPublicSearchIndexSnapshot.mockResolvedValue(searchSnapshot);
    const fetchMock = installCloudflareFetch();

    await expect(getPublicHomeSnapshot()).resolves.toEqual(homeSnapshot);
    await expect(getPublicContentListSnapshot("news")).resolves.toEqual(contentSnapshot);
    await expect(getContentDetail({ slug: "sample-news" })).resolves.toEqual(publicItem);
    await expect(getPublicProgramListSnapshot()).resolves.toEqual(programSnapshot);
    await expect(getPublicSearchIndexSnapshot()).resolves.toEqual(searchSnapshot);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Cloudflare for every migrated public read only when explicitly selected", async () => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    const fetchMock = installCloudflareFetch();

    await expect(getPublicHomeSnapshot()).resolves.toEqual(homeSnapshot);
    await expect(getPublicContentListSnapshot("news")).resolves.toEqual(contentSnapshot);
    await expect(getContentDetail({ slug: "sample-news" })).resolves.toEqual(publicItem);
    await expect(getPublicProgramListSnapshot()).resolves.toEqual(programSnapshot);
    await expect(getPublicSearchIndexSnapshot()).resolves.toEqual(searchSnapshot);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(appsScriptMocks.getPublicHomeSnapshot).not.toHaveBeenCalled();
    expect(appsScriptMocks.getPublicContentListSnapshot).not.toHaveBeenCalled();
    expect(appsScriptMocks.getContentDetail).not.toHaveBeenCalled();
    expect(appsScriptMocks.getPublicProgramListSnapshot).not.toHaveBeenCalled();
    expect(appsScriptMocks.getPublicSearchIndexSnapshot).not.toHaveBeenCalled();
  });

  it("builds the Contact/public shell snapshot from Cloudflare without calling Apps Script", async () => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    const fetchMock = installCloudflareFetch();

    await expect(getPublicCmsSnapshotForProvider()).resolves.toMatchObject({
      siteSettings: homeSnapshot.siteSettings,
      homepageSettings: homeSnapshot.homepageSettings,
      content: [publicItem]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(appsScriptMocks.getCmsSnapshot).not.toHaveBeenCalled();
    expect(appsScriptMocks.getPublicHomeSnapshot).not.toHaveBeenCalled();
  });
});
