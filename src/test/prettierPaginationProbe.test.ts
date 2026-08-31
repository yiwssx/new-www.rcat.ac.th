import { readFile } from "node:fs/promises";
import { format } from "prettier";
import { describe, expect, it } from "vitest";

describe("pagination prettier probe", () => {
  it("prints canonical pagination test formatting", async () => {
    const source = await readFile("src/public/hooks/usePublicPagination.test.tsx", "utf8");
    const formatted = await format(source, {
      filepath: "src/public/hooks/usePublicPagination.test.tsx",
      printWidth: 120,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: false,
      trailingComma: "none",
      bracketSpacing: true,
      arrowParens: "always",
      endOfLine: "lf"
    });

    console.log(`PRETTIER_OUTPUT_START\n${formatted}PRETTIER_OUTPUT_END`);
    expect(formatted.length).toBeGreaterThan(0);
  });
});
