import { describe, expect, it } from "vitest";
import { projectSettings } from "../../config/projectSettings";
import {
  buildPublicRouteHead,
  getCmsRouteHead,
  getPublicContentRouteHead,
  getRootRouteHead,
  getStaticPublicRouteHead
} from "./publicRouteHead";

function getMetaContent(head: ReturnType<typeof buildPublicRouteHead>, key: "name" | "title", value?: string) {
  if (key === "title") {
    return head.meta.find((entry) => "title" in entry)?.title;
  }

  return head.meta.find((entry) => "name" in entry && entry.name === value)?.content;
}

describe("public route head metadata", () => {
  it("keeps the root head limited to the default site title", () => {
    const head = getRootRouteHead();

    expect(getMetaContent(head, "title")).toBe(projectSettings.site.name);
    expect(getMetaContent(head, "name", "description")).toBeUndefined();
    expect(head.links).toEqual([]);
  });

  it("builds a static public route title, description, and canonical URL", () => {
    const head = getStaticPublicRouteHead("/news");

    expect(getMetaContent(head, "title")).toBe(`ข่าว | ${projectSettings.site.name}`);
    expect(getMetaContent(head, "name", "description")).toBe(
      "กิจกรรมล่าสุด เรื่องราวในสถานศึกษา และข่าวประชาสัมพันธ์จาก CMS"
    );
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

  it("marks the public search results route as noindex while keeping links followable", () => {
    const head = getStaticPublicRouteHead("/search");

    expect(getMetaContent(head, "name", "robots")).toBe("noindex,follow");
    expect(head.links).toEqual([{ rel: "canonical", href: `${projectSettings.site.publicSiteUrl}/search` }]);
  });

  it("canonicalizes both content route forms to the content detail path", () => {
    const head = getPublicContentRouteHead("welcome-to-rcat");

    expect(head.links).toEqual([
      {
        rel: "canonical",
        href: `${projectSettings.site.publicSiteUrl}/content/welcome-to-rcat`
      }
    ]);
  });

  it("keeps CMS auth and admin routes out of search indexes without a canonical link", () => {
    const head = getCmsRouteHead();

    expect(getMetaContent(head, "name", "robots")).toBe("noindex,nofollow");
    expect(head.links).toEqual([]);
  });
});
