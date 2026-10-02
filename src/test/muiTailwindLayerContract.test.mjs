// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesPath = fileURLToPath(new URL("../styles.css", import.meta.url));
const stylesSource = readFileSync(stylesPath, "utf8");
const canonicalLayerContract = '@layer theme, base, mui, components, utilities;\n@import "tailwindcss";';

describe("MUI + Tailwind cascade layer contract", () => {
  it("declares the canonical layer order before the Tailwind import", () => {
    expect(stylesSource.startsWith(`${canonicalLayerContract}\n`)).toBe(true);
  });

  it("reserves mui before RCAT components and Tailwind utilities", () => {
    const layerStatement = stylesSource.match(/^@layer\s+([^;]+);/)?.[1];
    expect(layerStatement?.split(/\s*,\s*/)).toEqual(["theme", "base", "mui", "components", "utilities"]);
  });
});
