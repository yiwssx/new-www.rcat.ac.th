// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesPath = fileURLToPath(new URL("../styles.css", import.meta.url));
const emotionCachePath = fileURLToPath(new URL("../emotionCache.ts", import.meta.url));
const appProvidersPath = fileURLToPath(new URL("../AppProviders.tsx", import.meta.url));
const stylesSource = readFileSync(stylesPath, "utf8");
const emotionCacheSource = readFileSync(emotionCachePath, "utf8");
const appProvidersSource = readFileSync(appProvidersPath, "utf8");
const canonicalLayerContract = '@layer theme, base, mui, components, utilities;\n@import "tailwindcss";';

describe("MUI + Tailwind cascade layer contract", () => {
  it("declares the canonical layer order before the Tailwind import", () => {
    expect(stylesSource.startsWith(`${canonicalLayerContract}\n`)).toBe(true);
  });

  it("reserves mui before RCAT components and Tailwind utilities", () => {
    const layerStatement = stylesSource.match(/^@layer\s+([^;]+);/)?.[1];
    expect(layerStatement?.split(/\s*,\s*/)).toEqual(["theme", "base", "mui", "components", "utilities"]);
  });

  it("classifies RCAT token aliases, base rules, and structural classes", () => {
    expect(stylesSource).toMatch(/@layer theme\s*{\s*:root\s*{/);
    expect(stylesSource).toMatch(/@layer base\s*{\s*\*\s*{/);
    expect(stylesSource).toMatch(/@layer components\s*{\s*\.table-scroll\s*{/);
    expect(stylesSource).toMatch(/@layer components[\s\S]*\.form-shell\s*{/);
    expect(stylesSource).toMatch(/@layer components[\s\S]*@keyframes cardIn\s*{/);
  });

  it("keeps MUI layer emission on the shared runtime-owned Emotion cache", () => {
    expect(emotionCacheSource).toContain('APP_EMOTION_CSS_LAYER = "mui"');
    expect(emotionCacheSource).toContain("cache.insert =");
    expect(appProvidersSource).not.toContain("StyledEngineProvider");
  });
});
