import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import prettier from "prettier";

const files = [
  "api/sitemap.mjs",
  "cloudflare/public-api/src/publicRoutePolicy.ts",
  "cloudflare/public-api/src/routes/adminReservedContentSlug.ts",
  "src/public/routing/publicRouteRegistry.ts"
] as const;

describe("route registry prettier probe", () => {
  it("prints canonical formatter output for changed files", async () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const formatted = await prettier.format(source, {
        filepath: file,
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

      if (formatted !== source) {
        console.log(`RCAT_PRETTIER_BEGIN:${file}`);
        console.log(Buffer.from(formatted, "utf8").toString("base64"));
        console.log(`RCAT_PRETTIER_END:${file}`);
      }
    }
  });
});
