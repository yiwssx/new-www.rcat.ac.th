// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_REDIRECT_CDN_CACHE_CONTROL,
  PUBLIC_SSR_BROWSER_CACHE_CONTROL,
  PUBLIC_SSR_CDN_CACHE_CONTROL,
  handleVercelPublicSsrRequest,
  reconstructPublicSsrRequest
} from "../vercelSsr";

const generatedAt = "2026-08-04T06:00:00.000Z";
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
  marquee: { enabled: false, label: "", text: "", speedSeconds: 20 },
  introVideo: { enabled: false, title: "", youtubeEmbedUrl: "" }
};

const publishedItem = {
  id: "content-published",
  title: "ข่าว SSR Production",
  slug: "published-news",
  type: "news",
  status: "published",
  owner: "งานประชาสัมพันธ์",
  summary: "ข่าวสำหรับตรวจ production SSR cutover",
  body: "เนื้อหาที่ crawler ต้องเห็นโดยไม่ใช้ JavaScript",
  updatedAt: "2026-08-04T05:30:00.000Z",
  publishAt: "2026-08-04T05:00:00.000Z"
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
    latestNews: [publishedItem],
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

function stubPublicApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));

      if (url.pathname === "/api/public/shell") {
        return Response.json(createShellPayload());
      }

      if (url.pathname === "/api/public/home") {
        return Response.json(createHomePayload());
      }

      if (url.pathname === "/api/public/content/published-news") {
        return Response.json({ item: publishedItem, media: [], generatedAt });
      }

      return Response.json({ error: `Unexpected request: ${url.pathname}${url.search}` }, { status: 404 });
    })
  );
}

describe("Vercel Public SSR production cutover", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.edu");
    stubPublicApi();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reconstructs the original public URL and preserves its search parameters", () => {
    const request = new Request(
      "https://www.rcat.ac.th/api/ssr?_rcatPath=/news&page=2&tag=%E0%B9%80%E0%B8%81%E0%B8%A9%E0%B8%95%E0%B8%A3"
    );
    const reconstructed = reconstructPublicSsrRequest(request);

    expect(reconstructed?.url).toBe(
      "https://www.rcat.ac.th/news?page=2&tag=%E0%B9%80%E0%B8%81%E0%B8%A9%E0%B8%95%E0%B8%A3"
    );
  });

  it("returns a complete no-JavaScript document with semantic content and hydration assets", async () => {
    const response = await handleVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/content/published-news")
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(PUBLIC_SSR_BROWSER_CACHE_CONTROL);
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(PUBLIC_SSR_CDN_CACHE_CONTROL);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="th" data-rcat-ssr="true">');
    expect(html).toContain("<head>");
    expect(html).toContain("/assets/rcat-client.css");
    expect(html).toContain('<div id="root">');
    expect(html).toContain("ข่าว SSR Production");
    expect(html).toContain("เนื้อหาที่ crawler ต้องเห็นโดยไม่ใช้ JavaScript");
    expect(html).toContain("/assets/rcat-client.js");
    expect(html).toContain("application/ld+json");
  });

  it("keeps Search out of CDN cache and index", async () => {
    const response = await handleVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/search&q=rice")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });

  it("caches permanent legacy redirects at the CDN while browsers revalidate", async () => {
    const response = await handleVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/published-news")
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toContain("/content/published-news");
    expect(response.headers.get("Cache-Control")).toBe(PUBLIC_SSR_BROWSER_CACHE_CONTROL);
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(PUBLIC_REDIRECT_CDN_CACHE_CONTROL);
  });

  it("returns no body for HEAD and rejects non-page methods", async () => {
    const headResponse = await handleVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/content/published-news", { method: "HEAD" })
    );
    const postResponse = await handleVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/content/published-news", { method: "POST" })
    );

    expect(headResponse.status).toBe(200);
    expect(await headResponse.text()).toBe("");
    expect(postResponse.status).toBe(405);
    expect(postResponse.headers.get("Allow")).toBe("GET, HEAD");
  });

  it("returns a protected 404 when the rewrite target is not a supported public route", async () => {
    const response = await handleVercelPublicSsrRequest(
      new Request("https://www.rcat.ac.th/api/ssr?_rcatPath=/admin/settings")
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});
