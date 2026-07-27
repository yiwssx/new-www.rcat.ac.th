import { describe, expect, it } from "vitest";
import {
  isPublicTelemetryPath,
  normalizePublicTelemetryPath,
  sanitizePublicTelemetryPageTitle
} from "../shared/telemetry/publicTelemetryRoutes";

describe("Public telemetry route policy", () => {
  it.each([
    "/login",
    "/login/",
    "/login?return=%2Fadmin",
    "/login/#credentials",
    "/activate-account",
    "/activate-account/",
    "/activate-account?token=INVITATION-TOKEN",
    "/activate-account/#token",
    "/reset-password",
    "/reset-password/",
    "/reset-password?token=RESET-TOKEN",
    "/reset-password/#token",
    "/admin",
    "/admin/",
    "/admin/content",
    "/admin/content/",
    "/admin/settings?tab=site",
    "/admin/users#permissions"
  ])("blocks %s", (pathname) => {
    expect(isPublicTelemetryPath(pathname)).toBe(false);
  });

  it.each([
    "/",
    "/news",
    "/news/",
    "/announcements",
    "/calendar",
    "/search?q=admission#results",
    "/content/news-1",
    "/content/news-1/",
    "/public-permalink",
    "/administrator",
    "/administer",
    "/admin-help",
    "/login-help",
    "/activate-account-help",
    "/reset-password-policy"
  ])("allows the genuine or near-matching Public path %s", (pathname) => {
    expect(isPublicTelemetryPath(pathname)).toBe(true);
  });

  it("normalizes leading and trailing slashes without retaining query or hash data", () => {
    expect(normalizePublicTelemetryPath("news/?q=private#secret")).toBe("/news");
    expect(normalizePublicTelemetryPath("/content/example///?token=private")).toBe("/content/example");
    expect(normalizePublicTelemetryPath("")).toBe("/");
  });

  it("omits query-derived search titles without changing other Public titles", () => {
    expect(sanitizePublicTelemetryPageTitle("/search?q=private", "ค้นหา: private")).toBe("");
    expect(sanitizePublicTelemetryPageTitle("/news", "ข่าวประชาสัมพันธ์")).toBe("ข่าวประชาสัมพันธ์");
  });
});
