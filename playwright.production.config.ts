import { defineConfig, devices } from "@playwright/test";

const configuredBaseUrl = process.env.PHASE_A_PRODUCTION_BASE_URL || "https://www.rcat.ac.th";
const productionBaseUrl = new URL(configuredBaseUrl);

if (productionBaseUrl.protocol !== "https:") {
  throw new Error("Phase A production browser smoke requires an HTTPS base URL.");
}

export default defineConfig({
  testDir: "./tests/production",
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  outputDir: "test-results/production",
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { outputFolder: "playwright-report/production", open: "never" }]
      ]
    : "list",
  use: {
    baseURL: productionBaseUrl.href,
    actionTimeout: 10_000,
    navigationTimeout: 25_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"]
      }
    }
  ]
});
