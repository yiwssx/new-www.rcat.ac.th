import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

describe("M21 Vercel security headers", () => {
  it("covers all frontend routes with baseline security headers and keeps CSP report-only before enforcement", () => {
    const allRoutesHeader = vercelConfig.headers.find((entry) => entry.source === "/(.*)");
    const reportOnlyPolicy = allRoutesHeader?.headers.find(
      (header) => header.key === "Content-Security-Policy-Report-Only"
    )?.value;
    const enforcingPolicy = allRoutesHeader?.headers.find((header) => header.key === "Content-Security-Policy");

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
    expect(reportOnlyPolicy).toContain("default-src 'self'");
    expect(reportOnlyPolicy).toContain("object-src 'none'");
    expect(reportOnlyPolicy).toContain("frame-ancestors 'none'");
    expect(reportOnlyPolicy).toContain("script-src 'self'");
    expect(reportOnlyPolicy).toContain("frame-src https://www.facebook.com");
    expect(reportOnlyPolicy).toContain("connect-src 'self' https://*.workers.dev https://*.rcat.ac.th");
    expect(reportOnlyPolicy).toContain("font-src 'self' data:");
    expect(reportOnlyPolicy).toContain("report-uri /api/csp-report");
    expect(enforcingPolicy).toBeUndefined();
    expect(JSON.stringify(vercelConfig)).not.toContain("preload");
  });

  it("does not depend on Google-hosted fonts before CSP enforcement", () => {
    const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const routeComponents = readFileSync(new URL("../routeComponents.tsx", import.meta.url), "utf8");
    const combined = `${indexHtml}\n${routeComponents}`;

    expect(combined).not.toContain("fonts.googleapis.com");
    expect(combined).not.toContain("fonts.gstatic.com");
  });
});
