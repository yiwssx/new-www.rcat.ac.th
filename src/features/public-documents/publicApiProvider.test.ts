import { describe, expect, it } from "vitest";
import { buildCloudflarePublicApiUrl, resolveCloudflarePublicApiBaseUrl } from "../../config/publicApiProvider";

describe("Cloudflare public API config", () => {
  it("normalizes browser and server Cloudflare base URLs by removing trailing slashes", () => {
    expect(
      resolveCloudflarePublicApiBaseUrl({
        VITE_CLOUDFLARE_PUBLIC_API_URL: " http://127.0.0.1:8787/// "
      })
    ).toBe("http://127.0.0.1:8787");
    expect(
      resolveCloudflarePublicApiBaseUrl({
        CLOUDFLARE_PUBLIC_API_URL: " https://public-api.example.edu/// "
      })
    ).toBe("https://public-api.example.edu");
  });

  it("prefers the server-only Cloudflare URL when both server and browser aliases are present", () => {
    expect(
      resolveCloudflarePublicApiBaseUrl({
        CLOUDFLARE_PUBLIC_API_URL: "https://server-public-api.example.edu/",
        VITE_CLOUDFLARE_PUBLIC_API_URL: "https://browser-public-api.example.edu/"
      })
    ).toBe("https://server-public-api.example.edu");
  });

  it("requires a Cloudflare URL when building a public API URL", () => {
    expect(() => buildCloudflarePublicApiUrl("/api/public/documents", {})).toThrow(
      "CLOUDFLARE_PUBLIC_API_URL or VITE_CLOUDFLARE_PUBLIC_API_URL"
    );
  });

  it("builds public API URLs without double slashes", () => {
    expect(
      buildCloudflarePublicApiUrl("/api/public/documents", {
        VITE_CLOUDFLARE_PUBLIC_API_URL: "http://127.0.0.1:8787/"
      })
    ).toBe("http://127.0.0.1:8787/api/public/documents");
  });
});
