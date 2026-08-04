import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const robotsUrl = new URL("../../public/robots.txt", import.meta.url);

describe("robots indexing policy", () => {
  it("allows public crawling while blocking CMS/Auth/API surfaces", async () => {
    const robots = await readFile(robotsUrl, "utf8");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /login");
    expect(robots).toContain("Disallow: /activate-account");
    expect(robots).toContain("Disallow: /reset-password");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).not.toContain("Disallow: /search");
    expect(robots).toContain("Sitemap: https://www.rcat.ac.th/sitemap.xml");
  });
});
