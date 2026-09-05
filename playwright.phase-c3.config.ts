import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PHASE_C3_PRODUCTION_BASE_URL;

if (!baseURL) {
  throw new Error("PHASE_C3_PRODUCTION_BASE_URL is required for the authenticated field suite.");
}

export default defineConfig({
  testDir: "./tests/field-authenticated",
  testMatch: "**/*.pw.ts",
  timeout: 120_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  outputDir: "test-results/phase-c3",
  use: {
    baseURL,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
