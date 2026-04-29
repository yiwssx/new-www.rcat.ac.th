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

  it("uses the provided public site name when available", () => {
    expect(buildDocumentTitle("Admissions", "CMS public site")).toBe("Admissions | CMS public site");
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

  it("does not expose unsafe canonical protocols", () => {
    updateDocumentMetadata({
      title: "SEO title",
      description: "SEO description",
      canonicalUrl: "javascript:alert(1)",
      canonicalPath: "/content/safe"
    });

    expect(document.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe(
      `${projectSettings.site.publicSiteUrl}/content/safe`
    );
  });
});
