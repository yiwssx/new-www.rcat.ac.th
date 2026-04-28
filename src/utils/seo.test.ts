import { describe, expect, it, beforeEach } from "vitest";
import { projectSettings } from "../config/projectSettings";
import { buildDocumentTitle, updateDocumentMetadata } from "./seo";

describe("seo metadata helpers", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("adds the site name to page titles", () => {
    expect(buildDocumentTitle("Admissions")).toBe(`Admissions | ${projectSettings.site.name}`);
  });

  it("updates document title, description, and canonical URL", () => {
    updateDocumentMetadata({
      title: "SEO title",
      description: "SEO description",
      canonicalPath: "/content/welcome"
    });

    expect(document.title).toBe(`SEO title | ${projectSettings.site.name}`);
    expect(document.querySelector("meta[name='description']")?.getAttribute("content")).toBe("SEO description");
    expect(document.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe(
      `${projectSettings.site.publicSiteUrl}/content/welcome`
    );
  });
});
