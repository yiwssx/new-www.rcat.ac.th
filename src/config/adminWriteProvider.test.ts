import { describe, expect, it } from "vitest";
import {
  buildCloudflareAdminApiUrl,
  getAdminWriteProvider,
  resolveAdminWriteProvider,
  resolveCloudflareAdminWriteConfig
} from "./adminWriteProvider";

describe("CMS-only admin structured write provider", () => {
  it("always selects Cloudflare and ignores obsolete browser provider input", () => {
    const resolveWithIgnoredInput = resolveAdminWriteProvider as unknown as (input: unknown) => "cloudflare";

    expect(getAdminWriteProvider()).toBe("cloudflare");
    expect(resolveWithIgnoredInput({ provider: "apps-script", migrationMode: "legacy" })).toBe("cloudflare");
  });

  it("returns only the fixed CMS Admin proxy configuration", () => {
    expect(resolveCloudflareAdminWriteConfig()).toEqual({
      baseUrl: "/api/admin-proxy",
      authMode: "server-proxy"
    });
  });

  it("builds only canonical protected Admin proxy URLs", () => {
    expect(buildCloudflareAdminApiUrl("/api/admin/snapshot")).toBe("/api/admin-proxy?path=%2Fapi%2Fadmin%2Fsnapshot");
    expect(() => buildCloudflareAdminApiUrl("/api/public/snapshot")).toThrow("only accepts /api/admin/ paths");
  });
});
