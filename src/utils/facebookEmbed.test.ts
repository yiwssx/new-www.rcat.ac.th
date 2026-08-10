import { describe, expect, it } from "vitest";
import {
  buildFacebookPostPluginUrl,
  clampFacebookPostPluginWidth,
  getFacebookEmbedKind,
  isFacebookReelUrl,
  isFacebookUrl,
  isValidFacebookPostUrl,
  normalizeFacebookPostUrl
} from "./facebookEmbed";

describe("facebookEmbed", () => {
  it("accepts common public Facebook post URLs", () => {
    expect(normalizeFacebookPostUrl("https://www.facebook.com/rcat/posts/12345")).toBe(
      "https://www.facebook.com/rcat/posts/12345"
    );
    expect(normalizeFacebookPostUrl("https://facebook.com/permalink.php?story_fbid=123&id=456")).toBe(
      "https://facebook.com/permalink.php?story_fbid=123&id=456"
    );
    expect(normalizeFacebookPostUrl("https://m.facebook.com/story.php?story_fbid=123&id=456")).toBe(
      "https://m.facebook.com/story.php?story_fbid=123&id=456"
    );
    expect(normalizeFacebookPostUrl("https://web.facebook.com/rcat/posts/12345")).toBe(
      "https://web.facebook.com/rcat/posts/12345"
    );
  });

  it("accepts direct Facebook Reel permalinks", () => {
    const reelUrl = "https://www.facebook.com/reel/123456789012345/?mibextid=test";

    expect(normalizeFacebookPostUrl(reelUrl)).toBe(reelUrl);
    expect(getFacebookEmbedKind(reelUrl)).toBe("reel");
    expect(isFacebookReelUrl(reelUrl)).toBe(true);
    expect(isValidFacebookPostUrl(reelUrl)).toBe(true);
  });

  it("rejects unsupported Facebook URL types", () => {
    expect(normalizeFacebookPostUrl("https://www.facebook.com/share/p/abc123/")).toBe("");
    expect(normalizeFacebookPostUrl("https://www.facebook.com/share/r/abc123/")).toBe("");
    expect(normalizeFacebookPostUrl("https://www.facebook.com/watch/?v=12345")).toBe("");
  });

  it("rejects unsafe or non-Facebook URLs", () => {
    expect(normalizeFacebookPostUrl("")).toBe("");
    expect(normalizeFacebookPostUrl("#")).toBe("");
    expect(normalizeFacebookPostUrl("javascript:alert(1)")).toBe("");
    expect(normalizeFacebookPostUrl("data:text/html,test")).toBe("");
    expect(normalizeFacebookPostUrl("http://www.facebook.com/rcat/posts/12345")).toBe("");
    expect(normalizeFacebookPostUrl("https://example.com/rcat/posts/12345")).toBe("");
    expect(normalizeFacebookPostUrl("https://www.facebook.com/settings")).toBe("");
    expect(isValidFacebookPostUrl("https://www.facebook.com/rcat/posts/12345")).toBe(true);
    expect(isValidFacebookPostUrl("https://example.com/rcat/posts/12345")).toBe(false);
  });

  it("identifies safe Facebook URLs even when they are not plugin-compatible post URLs", () => {
    expect(isFacebookUrl("https://www.facebook.com/settings")).toBe(true);
    expect(isValidFacebookPostUrl("https://www.facebook.com/settings")).toBe(false);
    expect(isFacebookUrl("http://www.facebook.com/settings")).toBe(false);
    expect(isFacebookUrl("https://example.com/settings")).toBe(false);
  });

  it("builds an encoded post iframe plugin URL from the original post URL", () => {
    const pluginUrl = buildFacebookPostPluginUrl({
      href: "https://www.facebook.com/rcat/posts/12345",
      showText: false,
      width: 520
    });

    const parsed = new URL(pluginUrl);

    expect(parsed.origin + parsed.pathname).toBe("https://www.facebook.com/plugins/post.php");
    expect(pluginUrl).toContain("href=https%3A%2F%2Fwww.facebook.com%2Frcat%2Fposts%2F12345");
    expect(parsed.searchParams.get("href")).toBe("https://www.facebook.com/rcat/posts/12345");
    expect(parsed.searchParams.get("show_text")).toBe("false");
    expect(parsed.searchParams.get("width")).toBe("520");
  });

  it("builds Facebook Reels with the embedded video plugin", () => {
    const reelUrl = "https://www.facebook.com/reel/123456789012345/";
    const pluginUrl = buildFacebookPostPluginUrl({
      href: reelUrl,
      showText: true,
      width: 440
    });

    const parsed = new URL(pluginUrl);

    expect(parsed.origin + parsed.pathname).toBe("https://www.facebook.com/plugins/video.php");
    expect(parsed.searchParams.get("href")).toBe(reelUrl);
    expect(parsed.searchParams.get("show_text")).toBe("false");
    expect(parsed.searchParams.get("width")).toBe("440");
  });

  it("does not build plugin URLs for invalid post URLs", () => {
    expect(
      buildFacebookPostPluginUrl({
        href: "https://example.com/rcat/posts/12345",
        showText: true,
        width: 500
      })
    ).toBe("");
  });

  it("clamps Facebook iframe widths", () => {
    expect(clampFacebookPostPluginWidth(300)).toBe(350);
    expect(clampFacebookPostPluginWidth(900)).toBe(750);
    expect(clampFacebookPostPluginWidth(Number.NaN)).toBe(500);
  });
});
