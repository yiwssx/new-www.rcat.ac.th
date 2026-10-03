import { describe, expect, it } from "vitest";
import { isValidCmsLink, isValidFacebookEmbedPermalink } from "./cmsLinkValidation";

describe("shared CMS link validation", () => {
  it("keeps navigation placeholders and rejects unsafe or protocol-relative links", () => {
    expect(isValidCmsLink("#", "navigation")).toBe(true);
    expect(isValidCmsLink("/", "navigation")).toBe(true);
    expect(isValidCmsLink("/#", "navigation")).toBe(true);
    expect(isValidCmsLink("//evil.example", "navigation")).toBe(false);
    expect(isValidCmsLink("javascript:alert(1)", "navigation")).toBe(false);
  });

  it("uses one Facebook permalink contract for post and Reel URLs", () => {
    expect(isValidFacebookEmbedPermalink("https://www.facebook.com/page/posts/123")).toBe(true);
    expect(isValidFacebookEmbedPermalink("https://www.facebook.com/reel/123")).toBe(true);
    expect(isValidFacebookEmbedPermalink("https://www.facebook.com/page/posts/")).toBe(false);
  });
});
