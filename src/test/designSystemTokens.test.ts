// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateContrastPair, getContrastRatio, hexToRgb } from "../design-system/accessibility";
import { designTokenCssVariables, designTokens, semanticStatusTokens } from "../design-system/tokens";

const repositoryRoot = resolve(import.meta.dirname, "..", "..");

const contrastPairs = [
  ["primary text / page", designTokens.color.textPrimary, designTokens.color.pageCanvas, 4.5],
  ["primary text / paper", designTokens.color.textPrimary, designTokens.color.surfaceDefault, 4.5],
  ["secondary text / page", designTokens.color.textSecondary, designTokens.color.pageCanvas, 4.5],
  ["secondary text / paper", designTokens.color.textSecondary, designTokens.color.surfaceDefault, 4.5],
  ["primary button", designTokens.color.textInverse, designTokens.color.brandPrimary, 4.5],
  ["accent button", designTokens.color.textOnAccent, designTokens.color.brandAccent, 4.5],
  ["destructive action", designTokens.color.textInverse, designTokens.color.error, 4.5],
  ["link / page", designTokens.color.link, designTokens.color.pageCanvas, 4.5],
  ["focus / page", designTokens.color.focusRing, designTokens.color.pageCanvas, 3],
  ["focus / paper", designTokens.color.focusRing, designTokens.color.surfaceDefault, 3],
  ["inverse footer", designTokens.color.textInverse, designTokens.color.surfaceInverse, 4.5]
] as const;

describe("canonical design-system tokens", () => {
  it("keeps institutional values in one semantic source", () => {
    expect(designTokens.color.brandPrimary).toBe("#2c7a3f");
    expect(designTokens.color.brandAccent).toBe("#b88700");
    expect(designTokens.color.textOnAccent).not.toBe(designTokens.color.textInverse);
    expect(designTokenCssVariables["--rcat-color-brand-primary"]).toBe(designTokens.color.brandPrimary);
    expect(designTokenCssVariables["--rcat-color-brand-accent"]).toBe(designTokens.color.brandAccent);

    const projectSettings = readFileSync(resolve(repositoryRoot, "src/config/project-settings.json"), "utf8");
    expect(projectSettings).not.toMatch(/"theme"\s*:/);
  });

  it("uses a bounded radius and elevation scale", () => {
    expect(designTokens.radius).toEqual({ none: 0, small: 4, medium: 8, large: 16, pill: 999 });
    expect(Object.keys(designTokens.elevation)).toEqual(["none", "low", "medium", "high", "overlay"]);
    expect(designTokens.elevation.none).toBe("none");
  });

  it("defines Thai-friendly typography, controls, focus, and motion", () => {
    expect(designTokens.typography.pageTitle.lineHeight).toBeGreaterThanOrEqual(1.3);
    expect(designTokens.typography.sectionTitle.lineHeight).toBeGreaterThanOrEqual(1.3);
    expect(designTokens.typography.body.lineHeight).toBeGreaterThanOrEqual(1.5);
    expect(designTokens.typography.caption.lineHeight).toBeGreaterThanOrEqual(1.5);
    expect(designTokens.control.compactHeight).toBe(40);
    expect(designTokens.control.comfortableHeight).toBe(44);
    expect(designTokens.control.iconButtonTarget).toBeGreaterThanOrEqual(44);
    expect(designTokens.control.inputHeight).toBe(48);
    expect(designTokens.control.focusRingThickness).toBeGreaterThanOrEqual(3);
    expect(designTokens.motion.duration.short).toBeLessThan(designTokens.motion.duration.standard);
    expect(designTokens.motion.duration.standard).toBeLessThan(designTokens.motion.duration.deliberate);
  });
});

describe("dependency-free contrast policy", () => {
  it("normalizes shorthand hex and calculates known ratios", () => {
    expect(hexToRgb("#fff")).toEqual({ red: 255, green: 255, blue: 255 });
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(() => hexToRgb("rgb(0,0,0)")).toThrow(TypeError);
  });

  it.each(contrastPairs)("%s passes its required ratio", (name, foreground, background, minimumRatio) => {
    const result = evaluateContrastPair({ name, foreground, background, minimumRatio });
    expect(result.passes, `${name}: ${result.ratio.toFixed(3)} < ${minimumRatio}`).toBe(true);
  });

  it.each(Object.entries(semanticStatusTokens))(
    "%s status text is not color-only and passes normal-text contrast",
    (name, token) => {
      const result = evaluateContrastPair({
        name,
        foreground: token.text,
        background: token.background,
        minimumRatio: 4.5
      });
      expect(result.passes, `${name}: ${result.ratio.toFixed(3)} < 4.5`).toBe(true);
    }
  );
});
