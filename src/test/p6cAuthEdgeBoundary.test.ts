// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("P6C auth edge recovery boundary", () => {
  it("keeps every CSR auth/admin entry point uncached and out of search indexes", () => {
    const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
    const headers = new Map(
      config.headers.map((rule: { source: string; headers: Array<{ key: string; value: string }> }) => [
        rule.source,
        new Map(rule.headers.map((header) => [header.key.toLowerCase(), header.value.toLowerCase()]))
      ])
    );

    for (const source of ["/login", "/activate-account", "/reset-password", "/admin", "/admin/:path*"]) {
      const routeHeaders = headers.get(source);
      expect(routeHeaders?.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(routeHeaders?.get("cache-control")).toBe("no-store");
    }
  });
});
