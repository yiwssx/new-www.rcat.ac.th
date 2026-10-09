import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ribbonSource from "../public/components/PublicMourningRibbon.tsx?raw";
import publicShellSource from "../public/components/PublicSiteShell.tsx?raw";
import {
  MOURNING_RIBBON_IDENTITY_PADDING,
  MOURNING_RIBBON_SIZE,
  MOURNING_RIBBON_TOP_BAR_PADDING
} from "../public/components/mourningRibbonLayout";

const breakpoints = ["xs", "sm", "md", "lg"] as const;
const ribbonVectorSource = readFileSync(new URL("../../public/mourning-ribbon.svg", import.meta.url), "utf8");
const indexHtmlSource = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

describe("mourning ribbon responsive layout", () => {
  it("keeps the ribbon prominent on mobile and increases its size on larger screens", () => {
    const sizes = breakpoints.map((breakpoint) => MOURNING_RIBBON_SIZE[breakpoint]);

    expect(sizes[0]).toBeGreaterThanOrEqual(120);
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index]).toBeGreaterThan(sizes[index - 1]);
    }
  });

  it("reserves enough space in the top bar without squeezing the identity section as much", () => {
    for (const breakpoint of breakpoints) {
      const size = MOURNING_RIBBON_SIZE[breakpoint];
      const topBarPadding = Number.parseInt(MOURNING_RIBBON_TOP_BAR_PADDING[breakpoint], 10);
      const identityPadding = Number.parseInt(MOURNING_RIBBON_IDENTITY_PADDING[breakpoint], 10);

      expect(topBarPadding).toBe(size);
      expect(identityPadding).toBeGreaterThanOrEqual(size * 0.75);
      expect(identityPadding).toBeLessThan(size);
    }
  });

  it("wires the responsive dimensions only into the public mourning ribbon shell", () => {
    expect(ribbonSource).toContain("width: MOURNING_RIBBON_SIZE");
    expect(publicShellSource).toContain("pl: mourningRibbonTopBarPadding");
    expect(publicShellSource).toContain("pl: mourningRibbonIdentityPadding");
    expect(publicShellSource).toContain("{mourningRibbonEnabled && <PublicMourningRibbon />}");
  });

  it("renders a genuine, self-contained SVG instead of scaling the old PNG", () => {
    expect(ribbonVectorSource).toContain('viewBox="0 0 128 128"');
    expect(ribbonVectorSource).toMatch(/<circle\b/g);
    expect(ribbonVectorSource).toMatch(/<path\b/g);
    expect(ribbonVectorSource).not.toMatch(/<(?:image|script|foreignObject|use|style)\b/i);
    expect(ribbonVectorSource).not.toMatch(/(?:data:image\/|href=|url\()/i);
    expect(ribbonSource).toContain('const MOURNING_RIBBON_ASSET = "/mourning-ribbon.svg"');
    expect(ribbonSource).toContain('aria-hidden="true"');
    expect(ribbonSource).toContain('pointerEvents: "none"');
    expect(ribbonSource).not.toContain("/mourning-ribbon.png");
  });

  it("preloads the same vector asset with the SVG content type", () => {
    expect(indexHtmlSource).toContain('href="/mourning-ribbon.svg" type="image/svg+xml"');
    expect(indexHtmlSource).not.toContain("/mourning-ribbon.png");
  });
});
