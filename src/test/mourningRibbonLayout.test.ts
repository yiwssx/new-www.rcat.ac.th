import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ribbonSource from "../public/components/PublicMourningRibbon.tsx?raw";
import publicShellSource from "../public/components/PublicSiteShell.tsx?raw";
import {
  MOURNING_RIBBON_IDENTITY_PADDING,
  MOURNING_RIBBON_SIZE,
  MOURNING_RIBBON_TOP_BAR_PADDING
} from "../public/components/mourningRibbonLayout";

const breakpoints = ["xs", "sm", "md", "lg"] as const;
const ribbonVectorSource = readFileSync(join(process.cwd(), "public/mourning-ribbon-v3.svg"), "utf8");
const indexHtmlSource = readFileSync(join(process.cwd(), "index.html"), "utf8");

describe("mourning ribbon responsive layout", () => {
  it("keeps the ribbon compact on mobile and prominent on larger screens", () => {
    const sizes = breakpoints.map((breakpoint) => MOURNING_RIBBON_SIZE[breakpoint]);

    expect(sizes[0]).toBe(64);
    expect(sizes[1]).toBe(72);
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index]).toBeGreaterThan(sizes[index - 1]);
    }
  });

  it("reserves enough space in the top bar without squeezing the identity section as much", () => {
    for (const breakpoint of breakpoints) {
      const size = MOURNING_RIBBON_SIZE[breakpoint];
      const identityPadding = Number.parseInt(MOURNING_RIBBON_IDENTITY_PADDING[breakpoint], 10);

      if (breakpoint === "md" || breakpoint === "lg") {
        expect(Number.parseInt(MOURNING_RIBBON_TOP_BAR_PADDING[breakpoint], 10)).toBe(size);
      }
      expect(identityPadding).toBeGreaterThanOrEqual(16);
      expect(identityPadding).toBeLessThan(size);
    }
  });

  it("wires the responsive dimensions only into the public mourning ribbon shell", () => {
    expect(ribbonSource).toContain("width: MOURNING_RIBBON_SIZE");
    expect(publicShellSource).toContain("pl: mourningRibbonTopBarPadding");
    expect(publicShellSource).toContain("pl: mourningRibbonIdentityPadding");
    expect(publicShellSource).not.toContain("pt: mourningRibbonEnabled ? { xs: 2.5, sm: 4.5, md: 0 } : 0");
    expect(publicShellSource).toContain('data-testid="public-mobile-topbar-primary"');
    expect(publicShellSource).toContain('data-testid="public-mobile-topbar-social"');
    expect(ribbonSource).toContain('position: "fixed"');
    expect(publicShellSource).toContain('data-testid="public-mobile-award"');
    expect(publicShellSource).toContain('data-testid="public-college-identity"');
    expect(publicShellSource).toContain("{mourningRibbonEnabled && <PublicMourningRibbon />}");
  });

  it("renders a genuine, self-contained SVG instead of scaling the old PNG", () => {
    expect(ribbonVectorSource).toContain('viewBox="0 0 128 128"');
    expect(ribbonVectorSource).toMatch(/<circle\b/g);
    expect(ribbonVectorSource).toMatch(/<path\b/g);
    expect(ribbonVectorSource).not.toContain('d="M0 0');
    expect(ribbonVectorSource).not.toContain('fill="#171717"');
    expect(ribbonVectorSource).toContain('cx="47" cy="47" r="33" fill="#fff"');
    expect(ribbonVectorSource).toContain('r="29.8" fill="none" stroke="#393939"');
    expect(ribbonVectorSource).toContain("M46.5 28.5C40 28.5 38 35");
    expect(ribbonVectorSource).toContain("M46.5 28.5C53.4 28.5 56.9 35.1");
    expect(ribbonVectorSource).toContain('stroke="#505050"');
    expect(ribbonVectorSource).toContain('stroke="#313131"');
    expect(ribbonVectorSource).not.toContain('cx="64" cy="64"');
    expect(ribbonVectorSource).not.toContain("M63 36C49");
    expect(ribbonVectorSource).not.toMatch(/<(?:image|script|foreignObject|use|style)\b/i);
    expect(ribbonVectorSource).not.toMatch(/(?:data:image\/|href=|url\()/i);
    expect(ribbonSource).toContain('const MOURNING_RIBBON_ASSET = "/mourning-ribbon-v3.svg"');
    expect(ribbonSource).toContain('aria-hidden="true"');
    expect(ribbonSource).toContain('pointerEvents: "none"');
    expect(ribbonSource).not.toContain("/mourning-ribbon.png");
    expect(ribbonSource).not.toContain('const MOURNING_RIBBON_ASSET = "/mourning-ribbon.svg"');
    expect(ribbonSource).not.toContain('const MOURNING_RIBBON_ASSET = "/mourning-ribbon-v2.svg"');
  });

  it("preloads the same vector asset with the SVG content type", () => {
    expect(indexHtmlSource).toContain('href="/mourning-ribbon-v3.svg" type="image/svg+xml"');
    expect(indexHtmlSource).not.toContain("/mourning-ribbon.png");
    expect(indexHtmlSource).not.toContain('href="/mourning-ribbon.svg"');
  });
});
