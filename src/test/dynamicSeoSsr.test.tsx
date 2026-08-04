// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomepageSettings, PublicContentDetailSnapshot, SiteSettings } from "../types";
import { renderSsrResponse } from "../entry-server";

const generatedAt = "2026-08-04T03:00:00.000Z";

const siteSettings: SiteSettings = {
  siteName: "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
  eyebrow: "RCAT",
  intro: "สถานศึกษาอาชีวศึกษาเกษตรเพื่อผู้เรียนและชุมชน",
  campus: "ร้อยเอ็ด",
  phone: "043-000-000",
  fax: "",
  email: "contact@rcat.ac.th",
  address: "จังหวัดร้อยเอ็ด ประเทศไทย",
  admissionUrl: "https://admission.example.edu",
  facebookUrl: "https://www.facebook.com/rcat",
  youtubeUrl: "https://www.youtube.com/@rcat",
  tiktokUrl: "https://www.tiktok.com/@rcat",
  heroTitle: "เรียนรู้ ลงมือทำ สร้างอาชีพ",
  heroDescription: "พัฒนาทักษะวิชาชีพด้านเกษตร เทคโนโลยี และธุรกิจ",
  heroChip: "RCAT",
  heroImageUrl: "https://cdn.example.edu/rcat-hero.jpg",
  directorName: "ผู้อำนวยการ",
  directorTitle: "ผู้อำนวยการวิทยาลัย",
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

const homepageSettings: HomepageSettings = {
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

const displaySettings = {
  dateFormat: "D MMMM BBBB",
  timeMode: "24h" as const
};

const detailSnapshot: PublicContentDetailSnapshot = {
  item: {
    id: "content-news-1",
    title: "ข่าวทดสอบ Dynamic SEO",
    slug: "dynamic-seo-news",
    type: "news",
    status: "published",
    owner: "งานประชาสัมพันธ์",
    summary: "สรุปข่าวสำหรับหน้าเนื้อหา",
    body: "เนื้อหาข่าวสำหรับ SSR",
    category: "กิจกรรม",
    tags: ["นักศึกษา", "อาชีวศึกษา"],
    seoTitle: "หัวข้อ SEO จาก CMS",
    seoDescription: "คำอธิบาย SEO จาก CMS",
    canonicalUrl: "/content/dynamic-seo-news",
    featuredMediaId: "media-featured",
    updatedAt: "2026-08-03T09:00:00.000Z",
    publishAt: "2026-08-02T08:00:00.000Z"
  },
  media: [
    {
      id: "media-featured",
      name: "ภาพข่าว",
      type: "image",
      size: "1200x630",
      owner: "งานประชาสัมพันธ์",
      driveUrl: "https://cdn.example.edu/news-original.jpg",
      previewUrl: "https://cdn.example.edu/news-social.jpg",
      updatedAt: "2026-08-03T09:00:00.000Z"
    }
  ],
  generatedAt
};

function createPublicShellPayload() {
  return {
    siteSettings,
    homepageSettings,
    displaySettings,
    menu: [],
    generatedAt
  };
}

function createPublicHomePayload() {
  return {
    siteSettings,
    homepageSettings,
    displaySettings,
    menu: [],
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
    media: detailSnapshot.media,
    generatedAt
  };
}

function getRequestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) {
    return input.url;
  }

  return String(input);
}

describe("dynamic Public SEO SSR", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PUBLIC_API_PROVIDER", "cloudflare");
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.edu");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(getRequestUrl(input), "https://www.rcat.ac.th");

        if (url.pathname === "/api/public/shell") {
          return Response.json(createPublicShellPayload());
        }

        if (url.pathname === "/api/public/home") {
          return Response.json(createPublicHomePayload());
        }

        if (url.pathname === "/api/public/content/dynamic-seo-news") {
          return Response.json(detailSnapshot);
        }

        return Response.json({ error: `Unexpected test request: ${url.pathname}` }, { status: 404 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("renders CMS title, social metadata and structured data into initial server HTML", async () => {
    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/content/dynamic-seo-news"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`หัวข้อ SEO จาก CMS | ${siteSettings.siteName}`);
    expect(html).toContain("คำอธิบาย SEO จาก CMS");
    expect(html).toContain("https://www.rcat.ac.th/content/dynamic-seo-news");
    expect(html).toContain("og:type");
    expect(html).toContain("article");
    expect(html).toContain("https://cdn.example.edu/news-social.jpg");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("EducationalOrganization");
    expect(html).toContain("NewsArticle");
    expect(html).toContain("BreadcrumbList");
  });
});
