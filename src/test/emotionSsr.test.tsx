// @vitest-environment node

import React from "react";
import { CacheProvider } from "@emotion/react";
import { Box, ThemeProvider } from "@mui/material";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_EMOTION_CACHE_KEY, createAppEmotionCache } from "../emotionCache";
import { createEmotionSsrResponseFinalizer, injectEmotionCriticalStyleTags } from "../emotionSsr";
import { renderSsrResponse } from "../entry-server";
import { theme } from "../theme";

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

  it("retains the pre-cutover fallback placement for non-document render fragments", () => {
    const html = "<!DOCTYPE html><main>content</main>";
    const styleTags = '<style data-emotion="css test">.css-test{color:red}</style>';

    expect(injectEmotionCriticalStyleTags(html, styleTags)).toBe(`<!DOCTYPE html>${styleTags}<main>content</main>`);
  });

  it("extracts component critical CSS from a MUI server render", async () => {
    const cache = createAppEmotionCache();
    const finalizeEmotionSsrResponse = createEmotionSsrResponseFinalizer(cache);
    const markup = renderToString(
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <Box sx={{ color: "primary.main", px: 2 }}>Styled content</Box>
        </ThemeProvider>
      </CacheProvider>
    );
    const response = await finalizeEmotionSsrResponse(
      new Response(`<!DOCTYPE html>${markup}`, {
        headers: { "content-type": "text/html; charset=UTF-8" }
      })
    );
    const html = await response.text();
    const styleMatch = html.match(/<style data-emotion="css ([^"]+)">([\s\S]*?)<\/style>/);

    expect(styleMatch).not.toBeNull();
    expect(styleMatch?.[1].trim()).not.toBe("");
    expect(styleMatch?.[2]).toContain(".css-");
    expect(html.indexOf('<style data-emotion="css ')).toBeLessThan(html.indexOf("Styled content"));
  });

  it("returns a full route document with Emotion critical styles inside head", async () => {
    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/news?page=2"));
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(html).toContain("ข่าว | วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด");

    const headStart = html.indexOf("<head>");
    const styleIndex = html.indexOf('<style data-emotion="css');
    const headEnd = html.indexOf("</head>");
    expect(styleIndex).toBeGreaterThan(headStart);
    expect(styleIndex).toBeLessThan(headEnd);
  });
});
