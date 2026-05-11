import { describe, expect, it } from "vitest";
import { isValidFacebookPostUrl, normalizeFacebookPostUrl } from "./facebookEmbed";

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
    expect(normalizeFacebookPostUrl("https://www.facebook.com/share/p/abc123/")).toBe(
      "https://www.facebook.com/share/p/abc123/"
    );
    expect(normalizeFacebookPostUrl("https://www.facebook.com/watch/?v=12345")).toBe(
      "https://www.facebook.com/watch/?v=12345"
    );
    expect(normalizeFacebookPostUrl("https://www.facebook.com/reel/12345")).toBe("https://www.facebook.com/reel/12345");
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
});
