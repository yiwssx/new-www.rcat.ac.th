import { describe, expect, it } from "vitest";
import {
  buildCloudflarePublicApiUrl,
  resolveCloudflarePublicApiBaseUrl,
  resolvePublicApiProvider
} from "../../config/publicApiProvider";

describe("public document API provider config", () => {
  it("defaults missing provider config to Apps Script", () => {
    expect(resolvePublicApiProvider({})).toBe("apps-script");
    expect(resolvePublicApiProvider({ VITE_PUBLIC_API_PROVIDER: "" })).toBe("apps-script");
  });

  it("defaults unknown provider config to Apps Script", () => {
    expect(resolvePublicApiProvider({ VITE_PUBLIC_API_PROVIDER: "worker" })).toBe("apps-script");
  });

  it("resolves explicit Apps Script and Cloudflare providers", () => {
    expect(resolvePublicApiProvider({ VITE_PUBLIC_API_PROVIDER: "apps-script" })).toBe("apps-script");
    expect(resolvePublicApiProvider({ VITE_PUBLIC_API_PROVIDER: "cloudflare" })).toBe("cloudflare");
  });

  it("does not require a Cloudflare URL when Apps Script is selected", () => {
    expect(resolvePublicApiProvider({ VITE_PUBLIC_API_PROVIDER: "apps-script" })).toBe("apps-script");
  });

  it("normalizes the Cloudflare base URL by removing trailing slashes", () => {
    expect(
      resolveCloudflarePublicApiBaseUrl({
        VITE_CLOUDFLARE_PUBLIC_API_URL: " http://127.0.0.1:8787/// "
      })
    ).toBe("http://127.0.0.1:8787");
  });

  it("requires a Cloudflare URL when building a Cloudflare public API URL", () => {
    expect(() =>
      buildCloudflarePublicApiUrl("/api/public/documents", {
        VITE_PUBLIC_API_PROVIDER: "cloudflare"
      })
    ).toThrow("VITE_CLOUDFLARE_PUBLIC_API_URL");
  });

  it("builds public API URLs without double slashes", () => {
    expect(
      buildCloudflarePublicApiUrl("/api/public/documents", {
        VITE_CLOUDFLARE_PUBLIC_API_URL: "http://127.0.0.1:8787/"
      })
    ).toBe("http://127.0.0.1:8787/api/public/documents");
  });
});
