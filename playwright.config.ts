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
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium"
      }
    }
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    timeout: 120_000,
    reuseExistingServer: true,
    env: {
      VITE_PUBLIC_API_PROVIDER: "cloudflare",
      VITE_CLOUDFLARE_PUBLIC_API_URL: functionalApiBaseUrl,
      VITE_PUBLIC_ANALYTICS_STRATEGY: "gtm",
      VITE_BACKEND_MIGRATION_MODE: "cloudflare-first-preview",
      VITE_ADMIN_WRITE_PROVIDER: "cloudflare",
      VITE_CLOUDFLARE_ADMIN_AUTH_MODE: "server-proxy",
      VITE_CLOUDFLARE_ADMIN_PROXY_URL: "/api/admin-proxy"
    }
  }
});
