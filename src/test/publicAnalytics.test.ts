import { describe, expect, it } from "vitest";
import { isPublicAnalyticsPath } from "../shared/utils/publicAnalytics";

describe("public analytics route guard", () => {
  it("blocks login and admin routes", () => {
    expect(isPublicAnalyticsPath("/login")).toBe(false);
    expect(isPublicAnalyticsPath("/login/")).toBe(false);
    expect(isPublicAnalyticsPath("/admin")).toBe(false);
    expect(isPublicAnalyticsPath("/admin/")).toBe(false);
    expect(isPublicAnalyticsPath("/admin/content")).toBe(false);
    expect(isPublicAnalyticsPath("/admin/settings?tab=site")).toBe(false);
  });

  it("allows public routes", () => {
    expect(isPublicAnalyticsPath("/")).toBe(true);
    expect(isPublicAnalyticsPath("/administrator")).toBe(true);
    expect(isPublicAnalyticsPath("/news")).toBe(true);
    expect(isPublicAnalyticsPath("/search?q=admission")).toBe(true);
    expect(isPublicAnalyticsPath("/content/news-1")).toBe(true);
  });
});
