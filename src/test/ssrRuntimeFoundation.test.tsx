// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectSettings } from "../config/projectSettings";
import { renderSsrResponse } from "../entry-server";
import { createAppRuntime } from "../runtime";

describe("SSR runtime foundation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "synthetic upstream unavailable" }, { status: 503 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an isolated QueryClient and Router pair for every runtime", () => {
    const first = createAppRuntime();
    const second = createAppRuntime();

    expect(first.queryClient).not.toBe(second.queryClient);
    expect(first.router).not.toBe(second.router);
    expect(first.router.options.context.queryClient).toBe(first.queryClient);
    expect(second.router.options.context.queryClient).toBe(second.queryClient);
  });

  it("renders route-aware HTML while preserving Phase 6 upstream HTTP semantics", async () => {
    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/news?page=2"));
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(html).toContain(`ข่าว | ${projectSettings.site.name}`);
    expect(html).toContain("https://www.rcat.ac.th/news?page=2");
  });

  it("does not leak route head state between sequential server requests", async () => {
    const newsResponse = await renderSsrResponse(new Request("https://www.rcat.ac.th/news"));
    const contactResponse = await renderSsrResponse(new Request("https://www.rcat.ac.th/contact"));
    const newsHtml = await newsResponse.text();
    const contactHtml = await contactResponse.text();

    expect(newsHtml).toContain(`ข่าว | ${projectSettings.site.name}`);
    expect(newsHtml).not.toContain(`ติดต่อ | ${projectSettings.site.name}`);
    expect(contactHtml).toContain(`ติดต่อ | ${projectSettings.site.name}`);
    expect(contactHtml).not.toContain(`ข่าว | ${projectSettings.site.name}`);
  });
});
