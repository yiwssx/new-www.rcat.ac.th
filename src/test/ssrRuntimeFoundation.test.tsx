// @vitest-environment node

import { describe, expect, it } from "vitest";
import { projectSettings } from "../config/projectSettings";
import { renderSsrResponse } from "../entry-server";
import { createAppRuntime } from "../runtime";

describe("SSR runtime foundation", () => {
  it("creates an isolated QueryClient and Router pair for every runtime", () => {
    const first = createAppRuntime();
    const second = createAppRuntime();

    expect(first.queryClient).not.toBe(second.queryClient);
    expect(first.router).not.toBe(second.router);
    expect(first.router.options.context.queryClient).toBe(first.queryClient);
    expect(second.router.options.context.queryClient).toBe(second.queryClient);
  });

  it("renders a route-aware HTML response from a Web Request", async () => {
    const response = await renderSsrResponse(new Request("https://www.rcat.ac.th/news?page=2"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
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
