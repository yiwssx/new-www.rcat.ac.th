import { describe, expect, it } from "vitest";
import { isExampleHostname, isValidCmsLink, isValidFacebookEmbedPermalink } from "./cmsLinkValidation";

describe("shared CMS link validation", () => {
  it("keeps navigation placeholders and rejects unsafe or protocol-relative links", () => {
    expect(isValidCmsLink("#", "navigation")).toBe(true);
    expect(isValidCmsLink("/", "navigation")).toBe(true);
    expect(isValidCmsLink("/#", "navigation")).toBe(true);
    expect(isValidCmsLink("//evil.example", "navigation")).toBe(false);
    expect(isValidCmsLink("javascript:alert(1)", "navigation")).toBe(false);
  });

  it("uses parsed host boundaries for example placeholder detection", () => {
    expect(isExampleHostname("https://example.com/path")).toBe(true);
    expect(isExampleHostname("https://www.example.com/path")).toBe(true);
    expect(isExampleHostname("https://EXAMPLE.COM/path")).toBe(true);
    expect(isExampleHostname("https://notexample.com/path")).toBe(false);
    expect(isExampleHostname("https://evil.invalid/?next=example.com")).toBe(false);
    expect(isExampleHostname("https://example.com@evil.invalid/path")).toBe(false);
    expect(isExampleHostname("https://service.invalid/example.com")).toBe(false);
    expect(isExampleHostname("/example.com")).toBe(false);
  });

  it("rejects deceptive external navigation URLs using the shared Worker contract", () => {
    expect(isValidCmsLink("//evil.invalid", "navigation", false)).toBe(false);
    expect(isValidCmsLink("https://user@service.invalid/path", "navigation", false)).toBe(false);
    expect(isValidCmsLink("javascript:alert(1)", "navigation", false)).toBe(false);
    expect(isValidCmsLink("https://service.invalid/path", "navigation", false)).toBe(true);
  });

  it.each([
    ["relative internal", "/services", true],
    ["external HTTPS", "https://portal.rcat.ac.th/path", true],
    ["external HTTP", "http://intranet.rcat.ac.th/path", true],
    ["email", "mailto:contact@rcat.ac.th", true],
    ["telephone", "tel:+66123456789", true],
    ["network path", "//evil.invalid/path", false],
    ["embedded credentials", "https://user:pass@portal.rcat.ac.th/path", false],
    ["unsafe scheme", "data:text/html,hello", false],
    ["malformed host", "https:///path", false],
    ["control character", "https://portal.rcat.ac.th/\\nnext", false]
  ])("enforces the shared navigation URL contract for %s", (_label, href, accepted) => {
    expect(isValidCmsLink(href, "navigation", false)).toBe(accepted);
  });

  it("uses one Facebook permalink contract for post and Reel URLs", () => {
    expect(isValidFacebookEmbedPermalink("https://www.facebook.com/page/posts/123")).toBe(true);
    expect(isValidFacebookEmbedPermalink("https://www.facebook.com/reel/123")).toBe(true);
    expect(isValidFacebookEmbedPermalink("https://www.facebook.com/page/posts/")).toBe(false);
    expect(isValidFacebookEmbedPermalink("https://actor@www.facebook.com/page/posts/123")).toBe(false);
    expect(isValidFacebookEmbedPermalink("https://www.facebook.com:8443/page/posts/123")).toBe(false);
  });
});
