import { existsSync, readFileSync } from "node:fs";
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
const ribbonVectorSource = readFileSync(join(process.cwd(), "public/mourning-ribbon.svg"), "utf8");
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
    expect(ribbonSource).toContain('position: "sticky"');
    expect(ribbonSource).toContain('position: "absolute"');
    expect(ribbonSource).toContain('data-mourning-ribbon-anchor="true"');
    expect(ribbonSource).toContain("height: 0");
    expect(ribbonSource).not.toContain('position: "fixed"');
    expect(publicShellSource.indexOf("{mourningRibbonEnabled && <PublicMourningRibbon />}")).toBeLessThan(
      publicShellSource.indexOf("<PublicIntroGate")
    );
    expect(publicShellSource).toContain('data-testid="public-mobile-award"');
    expect(publicShellSource).toContain('data-testid="public-college-identity"');
    expect(publicShellSource).toContain("{mourningRibbonEnabled && <PublicMourningRibbon />}");
  });

  it("uses the supplied standalone SVG artwork without embedded external resources", () => {
    expect(ribbonVectorSource).toContain('viewBox="0 0 128 128"');
    expect(ribbonVectorSource).toContain('<path d="M72 0H119L0 119V72Z" fill="#464646"/>');
    expect(ribbonVectorSource).toContain('cx="47.4" cy="47.3" r="33.1" fill="#fff"');
    expect(ribbonVectorSource).toContain('cx="47.4" cy="47.3" r="29.8"');
    expect(ribbonVectorSource).toContain('fill-rule="evenodd"');
    expect(ribbonVectorSource).not.toContain('fill="#171717"');
    expect(ribbonVectorSource).not.toMatch(/<(?:image|script|foreignObject|use|style)\b/i);
    expect(ribbonVectorSource).not.toMatch(/(?:data:image\/|href=|url\()/i);
    expect(ribbonSource).toContain('const MOURNING_RIBBON_ASSET = "/mourning-ribbon.svg?rev=4e0add4"');
    expect(ribbonSource).toContain('aria-hidden="true"');
    expect(ribbonSource).toContain('pointerEvents: "none"');
    expect(ribbonSource).not.toContain("/mourning-ribbon.png");
  });

  it("uses one cache-busted SVG URL and removes all retired image assets", () => {
    expect(indexHtmlSource).toContain('href="/mourning-ribbon.svg?rev=4e0add4" type="image/svg+xml"');
    for (const oldAsset of [
      "mourning-ribbon-v2.svg",
      "mourning-ribbon-v3.svg",
      "mourning-ribbon-v4.svg",
      "mourning-ribbon.png"
    ]) {
      expect(existsSync(join(process.cwd(), "public", oldAsset))).toBe(false);
    }
    expect(ribbonSource).not.toContain("/mourning-ribbon-v4.svg");
  });
});
