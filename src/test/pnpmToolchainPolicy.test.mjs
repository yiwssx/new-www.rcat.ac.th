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

  it("keeps setup manifest-managed except production push workflows pending explicit release approval", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    const pin = /^pnpm@(10\.\d+\.\d+)$/.exec(manifest.packageManager)?.[1];
    expect(pin).toBeTruthy();

    // These existing push-on-main workflows must not change as a side effect of
    // pnpm tooling maintenance: doing so can deploy the production image Worker
    // or delete eligible deployment/Actions history. They retain their current
    // exact pin until the separately authorized production workflow change.
    const protectedExceptions = new Map([
      [".github/workflows/image-production-worker.yml", 2],
      [".github/workflows/maintenance-recovery.yml", 1]
    ]);
    const paths = [
      ".github/actions/setup-project/action.yml",
      ...readdirSync(".github/workflows")
        .filter((name) => /\.ya?ml$/.test(name))
        .map((name) => ".github/workflows/" + name)
    ];
    let setupCount = 0;
    let exceptionCount = 0;
    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      const blocks = [
        ...source.matchAll(/uses: pnpm\/action-setup@v\d+([\s\S]*?)(?=\n[ \t]*-(?: name:| uses:| run:)|$)/g)
      ];
      if (protectedExceptions.has(path)) {
        expect(source, path).toMatch(/^  push:\s*$/m);
        expect(blocks, path).toHaveLength(protectedExceptions.get(path));
      }
      for (const [, options] of blocks) {
        setupCount += 1;
        expect(options).not.toMatch(/^\s*package_json_file:/m);
        expect(options).toContain("run_install: false");
        if (protectedExceptions.has(path)) {
          const explicitVersions = [...options.matchAll(/^\s*version:\s*(\S+)\s*$/gm)].map((match) => match[1]);
          expect(explicitVersions, path).toEqual([pin]);
          exceptionCount += 1;
        } else {
          expect(options, path).not.toMatch(/^\s*version:/m);
        }
      }
    }
    expect(setupCount).toBe(18);
    expect(exceptionCount).toBe(3);
  });
});
