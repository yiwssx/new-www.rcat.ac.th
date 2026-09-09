// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readRepoFile = (relativePath: string) => readFileSync(join(repositoryRoot, relativePath), "utf8");

const nodeVersion = readRepoFile(".node-version").trim();
const packageJson = JSON.parse(readRepoFile("package.json")) as {
  engines?: { node?: string; pnpm?: string };
  packageManager?: string;
};
const dependencyGuide = readRepoFile("docs/development/dependency-update-and-warning-cleanup.md");
const environmentGuide = readRepoFile("docs/development/environment-variables.md");

describe("repository hygiene consistency", () => {
  it("keeps current toolchain guidance aligned with the repository pins", () => {
    expect(nodeVersion).toMatch(/^24\.\d+\.\d+$/);
    expect(packageJson.engines?.node).toBe("24.x");
    expect(packageJson.engines?.pnpm).toBe("10.34.5");
    expect(packageJson.packageManager).toBe("pnpm@10.34.5");

    for (const source of [dependencyGuide, environmentGuide]) {
      expect(source).toContain(`Node \`${nodeVersion}\``);
      expect(source).toContain("pnpm `10.34.5`");
    }
  });

  it("keeps runtime sitemap ownership single-sourced", () => {
    expect(existsSync(join(repositoryRoot, "api", "sitemap.mjs"))).toBe(true);
    expect(existsSync(join(repositoryRoot, "scripts", "generate-sitemap.mjs"))).toBe(false);
    expect(dependencyGuide).toContain("Vercel serves `/sitemap.xml` through `api/sitemap.mjs`");
    expect(dependencyGuide).toContain("was removed during the 2026-09-09 repository cleanup");
  });
});
