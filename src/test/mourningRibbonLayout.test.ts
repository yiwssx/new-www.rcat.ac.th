import { describe, expect, it } from "vitest";
import ribbonSource from "../public/components/PublicMourningRibbon.tsx?raw";
import publicShellSource from "../public/components/PublicSiteShell.tsx?raw";
import {
  MOURNING_RIBBON_IDENTITY_PADDING,
  MOURNING_RIBBON_SIZE,
  MOURNING_RIBBON_TOP_BAR_PADDING
} from "../public/components/mourningRibbonLayout";

const breakpoints = ["xs", "sm", "md", "lg"] as const;

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
});
