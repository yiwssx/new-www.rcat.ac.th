// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderSsrResponse } from "../entry-server";

const generatedAt = "2026-08-04T05:00:00.000Z";

const siteSettings = {
  siteName: "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
  eyebrow: "RCAT",
  intro: "สถานศึกษาอาชีวศึกษาเกษตรเพื่อผู้เรียนและชุมชน",
  campus: "ร้อยเอ็ด",
  phone: "043-000-000",
  fax: "",
  email: "contact@rcat.ac.th",
  address: "จังหวัดร้อยเอ็ด ประเทศไทย",
  admissionUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  heroTitle: "RCAT",
  heroDescription: "เว็บไซต์สถานศึกษา",
  heroChip: "RCAT",
  heroImageUrl: "",
  directorName: "",
  directorTitle: "",
  directorDescription: "",
  directorImageUrl: "",
  mapUrl: "",
  mapEmbedUrl: "",
  footerTitle: "RCAT",
  footerDescription: "",
  footerDirectoryGroups: [],
  messengerUrl: "",
  messengerLabel: "",
  messengerEnabled: false,
  mourningModeEnabled: false,
  mourningModeLabel: "",
  mourningModeNotice: ""
};

const homepageSettings = {
  carousel: {
    autoplayEnabled: false,
    autoplayIntervalSeconds: 5,
    showArrows: true,
    showDots: true,
    pauseOnHover: true,
    pauseOnFocus: true,
    transition: "slide"
  },
  introGate: {
    enabled: false,
    imageUrl: "",
    imageAlt: "",
    primaryButtonLabel: "เข้าสู่เว็บไซต์",
    secondaryButtonLabel: "",
    secondaryButtonUrl: "",
    storageKey: "rcat.intro.dismissed"
  },
  marquee: {
    enabled: false,
    label: "",
    text: "",
    speedSeconds: 20
  },
  introVideo: {
    enabled: false,
    title: "",
    youtubeEmbedUrl: ""
  }
};

const publishedItem = {
  id: "content-published",
  title: "ข่าวที่เผยแพร่",
  slug: "published-news",
  type: "news",
  status: "published",
  owner: "งานประชาสัมพันธ์",
  summary: "ข่าวสำหรับทดสอบ HTTP semantics",
  body: "เนื้อหาข่าว",
  updatedAt: "2026-08-04T04:00:00.000Z",
  publishAt: "2026-08-04T03:00:00.000Z"
};

function createShellPayload() {
  return {
    siteSettings,
    homepageSettings,
    displaySettings: { dateFormat: "D MMMM BBBB", timeMode: "24h" },
    menu: [],
    generatedAt
  };
}

function createHomePayload() {
  return {
    ...createShellPayload(),
    carouselSlides: [],
    externalServices: [],
    visitorStats: {
      enabled: false,
      usersToday: 0,
      usersYesterday: 0,
      usersThisMonth: 0,
      usersThisYear: 0,
      totalUsers: 0,
      totalViews: 0,
      onlineUsers: 0,
      updatedAt: generatedAt
    },
    latestNews: [],
    latestAnnouncements: [],
    procurementItems: [],
    jobOpportunityItems: [],
    achievementItems: [],
    programItems: [],
    documentItems: [],
    eventItems: [],
    media: []
  };
}

function createDetailPayload() {
  return {
    item: publishedItem,
    media: [],
    generatedAt
  };
}

function requestUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

describe("Public SSR HTTP semantics", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.edu");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubPublicApi(options: { missingDetail?: boolean; failNews?: boolean } = {}) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(requestUrl(input));

        if (url.pathname === "/api/public/shell") {
          return Response.json(createShellPayload());
        }

        if (url.pathname === "/api/public/home") {
          return Response.json(createHomePayload());
        }

        if (url.pathname === "/api/public/content/published-news") {
          if (options.missingDetail) {
            return Response.json({ error: "Content not found" }, { status: 404 });
          }

          return Response.json(createDetailPayload());
        }

        if (url.pathname === "/api/public/content" && url.searchParams.get("kind") === "news") {
          if (options.failNews) {
            return Response.json({ error: "upstream unavailable" }, { status: 503 });
          }

          return Response.json({
            kind: "news",
            items: [publishedItem],
            media: [],
            siteSettings,
            homepageSettings,
            menu: [],
            generatedAt
          });
        }

        return Response.json({ error: `Unexpected request: ${url.pathname}${url.search}` }, { status: 404 });
      })
    );
  }

  it("returns 200 for a published canonical content route", async () => {
    stubPublicApi();

    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/content/published-news"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("returns 404 and noindex for missing content", async () => {
    stubPublicApi({ missingDetail: true });

    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/content/published-news"));

    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a permanent redirect from the legacy permalink to the canonical content path", async () => {
    stubPublicApi();

    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/published-news"));

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toContain("/content/published-news");
  });

  it("returns 503 with retry and noindex headers when a Public API loader fails", async () => {
    stubPublicApi({ failNews: true });

    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/news"));

    expect(response.status).toBe(503);
    expect(response.statusText).toBe("Service Unavailable");
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("adds response-level noindex protection to Search and CMS/Auth routes", async () => {
    stubPublicApi();

    const searchResponse = await renderSsrResponse(new Request("https://www.rcat.ac.th/search"));
    const loginResponse = await renderSsrResponse(new Request("https://www.rcat.ac.th/login"));

    expect(searchResponse.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    expect(loginResponse.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});
