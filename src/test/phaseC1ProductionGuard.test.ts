import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Phase C1 production field guard", () => {
  it("puts the public header search accessible name on the native input", () => {
    const source = readFileSync("src/public/components/PublicSiteShell.tsx", "utf8");

    expect(source).toContain('htmlInput: { "aria-label": "ค้นหาในเว็บไซต์" }');
    expect(source).not.toContain('placeholder="ค้นหาในเว็บไซต์"\n                      aria-label="ค้นหาในเว็บไซต์"');
  });

  it("keeps production browser verification serial and low impact", () => {
    const source = readFileSync("playwright.production.config.ts", "utf8");

    expect(source).toMatch(/fullyParallel:\s*false/);
    expect(source).toMatch(/workers:\s*1/);
  });

  it("audits only form controls exposed to the accessibility tree", () => {
    const source = readFileSync("tests/production/production.accessibility.pw.ts", "utf8");

    expect(source).toContain("!element.closest('[aria-hidden=\"true\"]')");
    expect(source).toContain("input:not([type='hidden']), select, textarea");
  });
});