import { defineConfig } from "@playwright/test";

const functionalApiBaseUrl = "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./tests/functional",
  timeout: 60_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    timeout: 120_000,
    reuseExistingServer: true,
    env: {
      VITE_PUBLIC_API_PROVIDER: "cloudflare",
      VITE_CLOUDFLARE_PUBLIC_API_URL: functionalApiBaseUrl
    }
  }
});
