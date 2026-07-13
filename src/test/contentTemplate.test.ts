import { describe, expect, it } from "vitest";
import { resolveContentTemplate } from "../utils/contentTemplate";

const facebookUrl = "https://www.facebook.com/100063746585360/posts/111";

describe("resolveContentTemplate", () => {
  it.each([
    ["standard", facebookUrl, "standard"],
    ["feature", facebookUrl, "feature"],
    ["update", facebookUrl, "update"],
    ["facebook-embed", "https://example.edu/news", "facebook-embed"],
    ["", facebookUrl, "facebook-embed"],
    [undefined, facebookUrl, "facebook-embed"],
    ["", "https://example.edu/news", "standard"],
    ["legacy-layout", facebookUrl, "standard"],
    ["  feature  ", facebookUrl, "feature"]
  ])("resolves template %j with canonical URL %j to %s", (template, canonicalUrl, expected) => {
    expect(resolveContentTemplate({ template, canonicalUrl })).toBe(expected);
  });
});
