import { describe, expect, it } from "vitest";
import {
  buildCloudflareAdminApiUrl,
  resolveAdminWriteProvider,
  resolveCloudflareAdminWriteConfig
} from "./adminWriteProvider";

const cmsAdminEnv = {
  VITE_ADMIN_WRITE_PROVIDER: "cloudflare",
  VITE_BACKEND_MIGRATION_MODE: "cloudflare-first-preview",
  VITE_CLOUDFLARE_ADMIN_PROXY_URL: "/api/admin-proxy"
};

describe("CMS-only admin structured write provider", () => {
  it("defaults to the disabled compatibility provider for missing, empty, or unknown values", () => {
    expect(resolveAdminWriteProvider({})).toBe("apps-script");
    expect(resolveAdminWriteProvider({ VITE_ADMIN_WRITE_PROVIDER: "" })).toBe("apps-script");
    expect(resolveAdminWriteProvider({ VITE_ADMIN_WRITE_PROVIDER: "worker" })).toBe("apps-script");
  });

  it("selects Cloudflare only with the exact same-origin CMS Admin proxy", () => {
    expect(resolveAdminWriteProvider(cmsAdminEnv)).toBe("cloudflare");
    expect(
      resolveAdminWriteProvider({
        ...cmsAdminEnv,
        VITE_BACKEND_MIGRATION_MODE: "legacy-apps-script"
      })
    ).toBe("apps-script");
    expect(
      resolveAdminWriteProvider({
        ...cmsAdminEnv,
        VITE_CLOUDFLARE_ADMIN_PROXY_URL: "https://preview-worker.example.test/api/admin-proxy"
      })
    ).toBe("apps-script");
  });

  it("returns only the fixed CMS Admin proxy configuration", () => {
    expect(resolveCloudflareAdminWriteConfig(cmsAdminEnv)).toEqual({
      baseUrl: "/api/admin-proxy",
      authMode: "server-proxy"
    });
  });

  it("rejects missing, absolute, or alternate proxy paths", () => {
    expect(() => resolveCloudflareAdminWriteConfig({})).toThrow("same-origin CMS Admin proxy");
    expect(() =>
      resolveCloudflareAdminWriteConfig({
        VITE_CLOUDFLARE_ADMIN_PROXY_URL: "https://preview-worker.example.test/api/admin-proxy"
      })
    ).toThrow("same-origin CMS Admin proxy");
    expect(() =>
      resolveCloudflareAdminWriteConfig({
        VITE_CLOUDFLARE_ADMIN_PROXY_URL: "/api/other-proxy"
      })
    ).toThrow("same-origin CMS Admin proxy");
  });

  it("builds only canonical protected Admin proxy URLs", () => {
    expect(buildCloudflareAdminApiUrl("/api/admin/snapshot", cmsAdminEnv)).toBe(
      "/api/admin-proxy?path=%2Fapi%2Fadmin%2Fsnapshot"
    );
    expect(() => buildCloudflareAdminApiUrl("/api/public/snapshot", cmsAdminEnv)).toThrow(
      "only accepts /api/admin/ paths"
    );
  });
});
