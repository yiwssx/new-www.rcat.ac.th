import { describe, expect, it } from "vitest";
import { projectSettings } from "../../config/projectSettings";
import type { PublicContentDetailSnapshot, SiteSettings } from "../../types";
import {
  buildPublicRouteHead,
  getCmsRouteHead,
  getPublicContentRouteHead,
  getPublicLayoutRouteHead,
  getRootRouteHead,
  getStaticPublicRouteHead
} from "./publicRouteHeadImpl";
import { serializePublicJsonLd } from "./publicSeo";

function getMetaContent(
  head: ReturnType<typeof buildPublicRouteHead>,
  key: "name" | "property" | "title",
  value?: string
) {
  if (key === "title") {
    return head.meta.find((entry) => "title" in entry)?.title;
  }

  return head.meta.find((entry) => key in entry && entry[key] === value)?.content;
}

function getJsonLd(head: ReturnType<typeof buildPublicRouteHead>, id: string) {
  const script = head.scripts.find((entry) => entry.id === id);
  return script ? JSON.parse(script.children) : undefined;
}

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

const detailSnapshot: PublicContentDetailSnapshot = {
  item: {
    id: "content-news-1",
    title: "ข่าวทดสอบ Dynamic SEO",
    slug: "dynamic-seo-news",
    type: "news",
    status: "published",
    owner: "งานประชาสัมพันธ์",
    summary: "สรุปข่าวสำหรับหน้าเนื้อหา",
    body: "เนื้อหาข่าว",
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
  generatedAt: "2026-08-03T09:01:00.000Z"
};

const detailLoaderData = {
  item: detailSnapshot.item,
  cmsSnapshot: {
    metrics: [],
    content: [detailSnapshot.item],
    media: detailSnapshot.media,
    events: [],
    siteSettings
  }
};

describe("public route head metadata", () => {
  it("keeps the root head limited to the default site title", () => {
    const head = getRootRouteHead();

    expect(getMetaContent(head, "title")).toBe(projectSettings.site.name);
    expect(getMetaContent(head, "name", "description")).toBeUndefined();
    expect(getMetaContent(head, "property", "og:title")).toBeUndefined();
    expect(head.links).toEqual([]);
  });

  it("builds a static public route title, description, canonical, OG and Twitter metadata", () => {
    const head = getStaticPublicRouteHead("/news");

    expect(getMetaContent(head, "title")).toBe(`ข่าว | ${projectSettings.site.name}`);
    expect(getMetaContent(head, "name", "description")).toBe(
      "กิจกรรมล่าสุด เรื่องราวในสถานศึกษา และข่าวประชาสัมพันธ์จาก CMS"
    );
    expect(getMetaContent(head, "property", "og:title")).toBe(`ข่าว | ${projectSettings.site.name}`);
    expect(getMetaContent(head, "property", "og:type")).toBe("website");
    expect(getMetaContent(head, "name", "twitter:title")).toBe(`ข่าว | ${projectSettings.site.name}`);
    expect(head.links).toEqual([{ rel: "canonical", href: `${projectSettings.site.publicSiteUrl}/news` }]);
  });

  it("keeps normalized pagination in self-referencing canonicals without copying filters or tracking params", () => {
    const pageTwo = getStaticPublicRouteHead("/news", {
      page: "2",
      tag: "award",
      utm_source: "newsletter"
    });
    const pageOne = getStaticPublicRouteHead("/news", { page: "1" });

    expect(pageTwo.links).toEqual([{ rel: "canonical", href: `${projectSettings.site.publicSiteUrl}/news?page=2` }]);
    expect(pageOne.links).toEqual([{ rel: "canonical", href: `${projectSettings.site.publicSiteUrl}/news` }]);
  });

  it("keeps both independent announcement pagination channels in canonical order", () => {
    const head = getStaticPublicRouteHead("/announcements", {
      announcementsPage: "3",
      pagesPage: 2,
      category: "ประกาศ"
    });

    expect(head.links).toEqual([
      {
        rel: "canonical",
        href: `${projectSettings.site.publicSiteUrl}/announcements?announcementsPage=3&pagesPage=2`
      }
    ]);
  });

  it("marks search noindex and derives a useful title from the validated query", () => {
    const head = getStaticPublicRouteHead("/search", { q: "รับสมัคร" });

    expect(getMetaContent(head, "title")).toBe(`ผลการค้นหา “รับสมัคร” | ${projectSettings.site.name}`);
    expect(getMetaContent(head, "name", "robots")).toBe("noindex,follow");
    expect(head.links).toEqual([{ rel: "canonical", href: `${projectSettings.site.publicSiteUrl}/search` }]);
  });

  it("uses Public shell settings for default social metadata and Organization JSON-LD", () => {
    const head = getPublicLayoutRouteHead({ siteSettings });
    const organization = getJsonLd(head, "rcat-organization-jsonld");

    expect(getMetaContent(head, "property", "og:site_name")).toBe(siteSettings.siteName);
    expect(getMetaContent(head, "property", "og:image")).toBe(siteSettings.heroImageUrl);
    expect(getMetaContent(head, "name", "twitter:card")).toBe("summary_large_image");
    expect(organization).toMatchObject({
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: siteSettings.siteName,
      email: siteSettings.email,
      telephone: siteSettings.phone
    });
    expect(organization.sameAs).toContain(siteSettings.facebookUrl);
  });

  it("renders WebSite and Breadcrumb structured data for Public routes", () => {
    const context = { loaderData: { siteSettings } };
    const homeHead = getStaticPublicRouteHead("/", undefined, context);
    const newsHead = getStaticPublicRouteHead("/news", undefined, context);

    expect(getJsonLd(homeHead, "rcat-website-jsonld")).toMatchObject({
      "@type": "WebSite",
      name: siteSettings.siteName
    });
    expect(getJsonLd(newsHead, "rcat-breadcrumb-jsonld").itemListElement).toHaveLength(2);
  });

  it("uses CMS SEO fields, featured image, Article metadata and NewsArticle JSON-LD for content detail", () => {
    const head = getPublicContentRouteHead("dynamic-seo-news", detailLoaderData);
    const contentJsonLd = getJsonLd(head, "rcat-content-jsonld");
    const breadcrumbJsonLd = getJsonLd(head, "rcat-breadcrumb-jsonld");

    expect(getMetaContent(head, "title")).toBe(`หัวข้อ SEO จาก CMS | ${siteSettings.siteName}`);
    expect(getMetaContent(head, "name", "description")).toBe("คำอธิบาย SEO จาก CMS");
    expect(getMetaContent(head, "property", "og:type")).toBe("article");
    expect(getMetaContent(head, "property", "og:image")).toBe("https://cdn.example.edu/news-social.jpg");
    expect(getMetaContent(head, "property", "article:published_time")).toBe(detailSnapshot.item.publishAt);
    expect(getMetaContent(head, "property", "article:modified_time")).toBe(detailSnapshot.item.updatedAt);
    expect(getMetaContent(head, "property", "article:section")).toBe("กิจกรรม");
    expect(head.links).toEqual([
      { rel: "canonical", href: `${projectSettings.site.publicSiteUrl}/content/dynamic-seo-news` }
    ]);
    expect(contentJsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: detailSnapshot.item.title,
      description: detailSnapshot.item.seoDescription,
      image: "https://cdn.example.edu/news-social.jpg"
    });
    expect(breadcrumbJsonLd.itemListElement).toHaveLength(3);
  });

  it("canonicalizes content without loader data to the content detail path", () => {
    const head = getPublicContentRouteHead("welcome-to-rcat");

    expect(head.links).toEqual([
      {
        rel: "canonical",
        href: `${projectSettings.site.publicSiteUrl}/content/welcome-to-rcat`
      }
    ]);
  });

  it("keeps CMS auth and admin routes out of search indexes without social or canonical metadata", () => {
    const head = getCmsRouteHead();

    expect(getMetaContent(head, "name", "robots")).toBe("noindex,nofollow");
    expect(getMetaContent(head, "property", "og:title")).toBeUndefined();
    expect(head.links).toEqual([]);
  });

  it("escapes less-than characters when serializing JSON-LD into inline script content", () => {
    const serialized = serializePublicJsonLd({ value: "</script><script>alert(1)</script>" });

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
  });
});
