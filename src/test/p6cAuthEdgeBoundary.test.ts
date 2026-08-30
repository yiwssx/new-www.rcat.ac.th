// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

describe("P6C auth edge recovery boundary", () => {
  it("keeps every CSR auth/admin entry point uncached and out of search indexes", () => {
    const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      headers: HeaderRule[];
    };
    const headers = new Map<string, Map<string, string>>(
      config.headers.map((rule) => [
        rule.source,
        new Map<string, string>(rule.headers.map((header) => [header.key.toLowerCase(), header.value.toLowerCase()]))
      ])
    );

    for (const source of ["/login", "/activate-account", "/reset-password", "/admin", "/admin/:path*"]) {
      const routeHeaders = headers.get(source);
      expect(routeHeaders?.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(routeHeaders?.get("cache-control")).toBe("no-store");
    }
  });

  it("embeds noindex and nofollow in the CSR shell source so proxy header transforms cannot remove the boundary", () => {
    const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8").toLowerCase();
    const robotsTag = (html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i) || [""])[0];
    expect(robotsTag).toContain("noindex");
    expect(robotsTag).toContain("nofollow");
  });
});
