import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

describe("M21 Vercel security headers", () => {
  it("covers all frontend routes with baseline security headers and leaves CSP deferred", () => {
    const allRoutesHeader = vercelConfig.headers.find((entry) => entry.source === "/(.*)");

    expect(allRoutesHeader).toBeDefined();
    expect(allRoutesHeader?.headers).toEqual(
      expect.arrayContaining([
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
      ])
    );
    expect(JSON.stringify(vercelConfig)).not.toContain("preload");
    expect(JSON.stringify(vercelConfig)).not.toContain("Content-Security-Policy");
  });
});
