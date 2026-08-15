import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["server/cmsAuth/cookies.mjs", "server/cmsAuth/rateLimiters.mjs", "src/features/public-read/request.ts"],
      thresholds: {
        "server/cmsAuth/cookies.mjs": {
          statements: 78,
          branches: 72,
          functions: 85,
          lines: 78,
          perFile: true
        },
        "server/cmsAuth/rateLimiters.mjs": {
          statements: 78,
          branches: 75,
          functions: 95,
          lines: 80,
          perFile: true
        },
        "src/features/public-read/request.ts": {
          statements: 82,
          branches: 65,
          functions: 88,
          lines: 84,
          perFile: true
        }
      }
    }
  }
});
