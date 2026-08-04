// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_EMOTION_CACHE_KEY, createAppEmotionCache } from "../emotionCache";
import { injectEmotionCriticalStyleTags } from "../emotionSsr";
import { renderSsrResponse } from "../entry-server";

describe("Emotion SSR styling", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "synthetic upstream unavailable" }, { status: 503 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates isolated caches with the stable browser/server key", () => {
    const first = createAppEmotionCache();
    const second = createAppEmotionCache();

    expect(first).not.toBe(second);
    expect(first.key).toBe(APP_EMOTION_CACHE_KEY);
    expect(second.key).toBe(APP_EMOTION_CACHE_KEY);

    first.inserted.synthetic = true;
    expect(second.inserted.synthetic).toBeUndefined();
  });

  it("places critical styles in head when a document head is available", () => {
    const html = "<!doctype html><html><head><title>RCAT</title></head><body><main>content</main></body></html>";
    const styleTags = '<style data-emotion="css test">.css-test{color:red}</style>';
    const rendered = injectEmotionCriticalStyleTags(html, styleTags);

    expect(rendered).toContain(`<title>RCAT</title>${styleTags}</head>`);
  });

  it("places critical styles immediately after the doctype for the current non-document SSR shell", () => {
    const html = "<!DOCTYPE html><main>content</main>";
    const styleTags = '<style data-emotion="css test">.css-test{color:red}</style>';

    expect(injectEmotionCriticalStyleTags(html, styleTags)).toBe(`<!DOCTYPE html>${styleTags}<main>content</main>`);
  });

  it("returns route HTML with extracted Emotion critical CSS before styled markup", async () => {
    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/news?page=2"));
    const html = await response.text();
    const styleMatch = html.match(/<style data-emotion="css ([^"]+)">([\s\S]*?)<\/style>/);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(styleMatch).not.toBeNull();
    expect(styleMatch?.[1].trim()).not.toBe("");
    expect(styleMatch?.[2]).toContain(".css-");

    const styleIndex = html.indexOf('<style data-emotion="css ');
    const styledMarkupIndex = html.indexOf('class="css-');
    expect(styleIndex).toBeGreaterThanOrEqual(0);
    expect(styledMarkupIndex).toBeGreaterThan(styleIndex);
  });
});
