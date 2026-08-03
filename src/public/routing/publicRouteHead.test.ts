import { describe, expect, it } from "vitest";
import { projectSettings } from "../../config/projectSettings";
import {
  buildPublicRouteHead,
  getCmsRouteHead,
  getPublicContentRouteHead,
  getStaticPublicRouteHead
} from "./publicRouteHead";

function getMetaContent(
  head: ReturnType<typeof buildPublicRouteHead>,
  key: "name" | "title",
  value?: string
) {
  if (key === "title") {
    return head.meta.find((entry) => "title" in entry)?.title;
  }

  return head.meta.find((entry) => "name" in entry && entry.name === value)?.content;
}

describe("public route head metadata", () => {
  it("builds a static public route title, description, and canonical URL", () => {
    const head = getStaticPublicRouteHead("/news");

    expect(getMetaContent(head, "title")).toBe(`ข่าว | ${projectSettings.site.name}`);
    expect(getMetaContent(head, "name", "description")).toBe(
      "กิจกรรมล่าสุด เรื่องราวในสถานศึกษา และข่าวประชาสัมพันธ์จาก CMS"
    );
    expect(head.links).toEqual([{ rel: "canonical", href: `${projectSettings.site.publicSiteUrl}/news` }]);
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

  it("keeps CMS auth and admin routes out of search indexes", () => {
    const head = getCmsRouteHead();

    expect(getMetaContent(head, "name", "robots")).toBe("noindex,nofollow");
    expect(head.links).toEqual([]);
  });
});
