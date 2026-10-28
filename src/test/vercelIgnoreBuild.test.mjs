// @vitest-environment node

import { describe, expect, it } from "vitest";
import { isVercelRuntimeImpactingPath, shouldIgnoreVercelBuild } from "../../scripts/vercel-ignore-build.mjs";

describe("Vercel runtime change classifier", () => {
  it("ignores known non-runtime-only changes", () => {
    expect(
      shouldIgnoreVercelBuild([
        ".github/workflows/dependency-status-sync.yml",
        "docs/maintenance/dependencies.md",
        "cloudflare/public-api/migrations/0012_example.sql",
        "src/test/example.test.ts"
      ])
    ).toBe(true);
  });

  it("ignores isolated CI-only changes without skipping adjacent runtime scripts", () => {
    expect(isVercelRuntimeImpactingPath("scripts/ci/report-job-times.mjs")).toBe(false);
    expect(isVercelRuntimeImpactingPath("scripts/ci/quality-gate.mjs")).toBe(false);
    expect(shouldIgnoreVercelBuild(["scripts/ci/report-job-times.mjs", ".github/workflows/ci.yml"])).toBe(true);
    expect(shouldIgnoreVercelBuild(["scripts/ci/report-job-times.mjs", "scripts/prepare-ssr-cutover-output.mjs"])).toBe(false);
    expect(isVercelRuntimeImpactingPath("scripts/unknown-script.mjs")).toBe(true);
  });

  it("builds for application and Vercel runtime paths", () => {
    for (const path of [
      "src/main.tsx",
      "src/features/public-read/request.ts",
      "api/ssr.ts",
      "server/cmsAuth/handlers.mjs",
      "public/fonts/sarabun.css",
      "package.json",
      "pnpm-lock.yaml",
      "vite.config.ts",
      "vercel.json",
      "scripts/prepare-ssr-cutover-output.mjs"
    ]) {
      expect(isVercelRuntimeImpactingPath(path), path).toBe(true);
    }
  });

  it("treats unknown paths conservatively as runtime-impacting", () => {
    expect(isVercelRuntimeImpactingPath("new-runtime-config.toml")).toBe(true);
    expect(shouldIgnoreVercelBuild(["docs/readme.md", "new-runtime-config.toml"])).toBe(false);
  });

  it("does not treat tests under src as runtime changes", () => {
    expect(isVercelRuntimeImpactingPath("src/features/example/foo.test.ts")).toBe(false);
    expect(isVercelRuntimeImpactingPath("src/features/example/foo.spec.tsx")).toBe(false);
  });
});
