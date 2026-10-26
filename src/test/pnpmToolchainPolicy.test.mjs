// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validatePnpmRuntime } from "../../scripts/pnpm-toolchain-policy.mjs";

describe("pnpm manifest toolchain policy", () => {
  it("accepts updated stable pnpm 10 pins without changing the major contract", () => {
    expect(validatePnpmRuntime("pnpm@10.34.5", "10.x", "10.34.5")).toBe(true);
    expect(validatePnpmRuntime("pnpm@10.35.1", "10.x", "10.35.1")).toBe(true);
  });

  it("rejects ranges, prereleases, major drift and a runtime different from the manifest", () => {
    for (const pin of ["pnpm@10.x", "pnpm@^10.34.5", "pnpm@11.0.0", "pnpm@10.35.0-rc.1", "npm@10.34.5"]) {
      expect(validatePnpmRuntime(pin, "10.x", "10.34.5")).toBe(false);
    }
    expect(validatePnpmRuntime("pnpm@10.34.5", "11.x", "10.34.5")).toBe(false);
    expect(validatePnpmRuntime("pnpm@10.34.5", "10.x", "10.35.0")).toBe(false);
  });

  it("leaves every action setup manifest-managed, including release and rollback paths", () => {
    const paths = [
      ".github/actions/setup-project/action.yml",
      ...readdirSync(".github/workflows")
        .filter((name) => /\.ya?ml$/.test(name))
        .map((name) => `.github/workflows/${name}`)
    ];
    let count = 0;
    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      const blocks = source.matchAll(/uses: pnpm\/action-setup@v\d+([\s\S]*?)(?=\n[ \t]*-(?: name:| uses:| run:)|$)/g);
      for (const [, options] of blocks) {
        count += 1;
        expect(options).not.toMatch(/^\s*version:/m);
        expect(options).not.toMatch(/^\s*package_json_file:/m);
        expect(options).toContain("run_install: false");
      }
    }
    expect(count).toBe(16);
  });
});
