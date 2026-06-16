import { describe, expect, it } from "vitest";
import {
  buildCloudflareAdminApiUrl,
  resolveAdminWriteProvider,
  resolveCloudflareAdminWriteConfig
} from "./adminWriteProvider";

describe("admin structured write provider", () => {
  it("defaults to Apps Script for missing, empty, or unknown values", () => {
    expect(resolveAdminWriteProvider({})).toBe("apps-script");
    expect(resolveAdminWriteProvider({ VITE_ADMIN_WRITE_PROVIDER: "" })).toBe("apps-script");
    expect(resolveAdminWriteProvider({ VITE_ADMIN_WRITE_PROVIDER: "worker" })).toBe("apps-script");
  });

  it("selects Cloudflare only for explicit cloudflare-first preview mode and Access auth", () => {
    expect(
      resolveAdminWriteProvider({
        VITE_ADMIN_WRITE_PROVIDER: "cloudflare",
        VITE_BACKEND_MIGRATION_MODE: "legacy-apps-script",
        VITE_CLOUDFLARE_PUBLIC_API_URL: "https://preview-worker.example.test",
        VITE_CLOUDFLARE_ADMIN_AUTH_MODE: "cloudflare-access"
      })
    ).toBe("apps-script");
    expect(
      resolveAdminWriteProvider({
        VITE_ADMIN_WRITE_PROVIDER: "cloudflare",
        VITE_BACKEND_MIGRATION_MODE: "cloudflare-first-preview",
        VITE_CLOUDFLARE_PUBLIC_API_URL: "https://preview-worker.example.test",
        VITE_CLOUDFLARE_ADMIN_AUTH_MODE: "cloudflare-access"
      })
    ).toBe("cloudflare");
  });

  it("uses the dedicated admin API URL when present and otherwise reuses the preview Worker URL", () => {
    expect(
      resolveCloudflareAdminWriteConfig({
        VITE_CLOUDFLARE_PUBLIC_API_URL: "https://preview-worker.example.test///",
        VITE_CLOUDFLARE_ADMIN_AUTH_MODE: "cloudflare-access"
      })
    ).toEqual({
      baseUrl: "https://preview-worker.example.test",
      authMode: "cloudflare-access"
    });

    expect(
      resolveCloudflareAdminWriteConfig({
        VITE_CLOUDFLARE_PUBLIC_API_URL: "https://preview-worker.example.test",
        VITE_CLOUDFLARE_ADMIN_API_URL: "https://preview-admin.example.test/",
        VITE_CLOUDFLARE_ADMIN_AUTH_MODE: "cloudflare-access"
      })
    ).toEqual({
      baseUrl: "https://preview-admin.example.test",
      authMode: "cloudflare-access"
    });
  });

  it("requires Cloudflare Access auth mode instead of a browser-visible secret", () => {
    expect(() =>
      resolveCloudflareAdminWriteConfig({
        VITE_CLOUDFLARE_PUBLIC_API_URL: "https://preview-worker.example.test"
      })
    ).toThrow("VITE_CLOUDFLARE_ADMIN_AUTH_MODE");
  });

  it("builds admin route URLs without changing cache keys or public provider settings", () => {
    expect(
      buildCloudflareAdminApiUrl("/api/admin/content", {
        VITE_CLOUDFLARE_PUBLIC_API_URL: "https://preview-worker.example.test/",
        VITE_CLOUDFLARE_ADMIN_AUTH_MODE: "cloudflare-access"
      })
    ).toBe("https://preview-worker.example.test/api/admin/content");
  });
});
