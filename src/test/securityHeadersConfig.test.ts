import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

describe("M21 Vercel security headers", () => {
  it("covers all frontend routes with baseline security headers and enforces the approved CSP", () => {
    const allRoutesHeader = vercelConfig.headers.find((entry) => entry.source === "/(.*)");
    const reportOnlyPolicy = allRoutesHeader?.headers.find(
      (header) => header.key === "Content-Security-Policy-Report-Only"
    );
    const enforcingPolicy = allRoutesHeader?.headers.find((header) => header.key === "Content-Security-Policy")?.value;

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
    expect(enforcingPolicy).toContain("default-src 'self'");
    expect(enforcingPolicy).toContain("object-src 'none'");
    expect(enforcingPolicy).toContain("frame-ancestors 'none'");
    expect(enforcingPolicy).toContain("script-src 'self'");
    expect(enforcingPolicy).toContain("frame-src https://www.facebook.com");
    expect(enforcingPolicy).toContain("connect-src 'self' https://*.workers.dev https://*.rcat.ac.th");
    expect(enforcingPolicy).toContain("font-src 'self' data:");
    expect(enforcingPolicy).toContain("report-uri /api/csp-report");
    expect(reportOnlyPolicy).toBeUndefined();
    expect(JSON.stringify(vercelConfig)).not.toContain("preload");

    expect(vercelConfig.rewrites).toContainEqual({
      source: "/api/csp-report",
      destination: "/api/complaint?_rcatComplaintRoute=csp-report"
    });
  });

  it("loads Sarabun locally and never depends on Google-hosted fonts", () => {
    const repositoryRoot = process.cwd();
    const indexHtml = readFileSync(path.join(repositoryRoot, "index.html"), "utf8");
    const routeComponents = readFileSync(path.join(repositoryRoot, "src", "routeComponents.tsx"), "utf8");
    const fontCss = readFileSync(path.join(repositoryRoot, "public", "fonts", "sarabun.css"), "utf8");
    const combined = `${indexHtml}\n${routeComponents}`;

    expect(combined).toContain('href="/fonts/sarabun.css"');
    expect(combined).not.toContain("fonts.googleapis.com");
    expect(combined).not.toContain("fonts.gstatic.com");
    expect(fontCss).toContain('font-family: "Sarabun"');
    expect(fontCss).toContain('url("/fonts/sarabun/Sarabun-Regular.ttf")');
    expect(fontCss).toContain('url("/fonts/sarabun/Sarabun-ExtraBold.ttf")');

    const fontHeader = vercelConfig.headers.find((entry) => entry.source === "/fonts/:path*");
    expect(fontHeader?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable"
    });
  });
});
