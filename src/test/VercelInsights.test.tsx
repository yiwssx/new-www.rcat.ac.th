import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VercelInsights } from "../shared/components/VercelInsights";
import {
  sanitizeVercelAnalyticsEvent,
  sanitizeVercelSpeedInsightEvent
} from "../shared/telemetry/vercelTelemetryPrivacy";

interface MockAnalyticsProps {
  beforeSend?: typeof sanitizeVercelAnalyticsEvent;
  path?: string;
  route?: string;
}

interface MockSpeedInsightsProps {
  beforeSend?: typeof sanitizeVercelSpeedInsightEvent;
  route?: string;
}

const vendorMocks = vi.hoisted(() => ({
  analytics: vi.fn((_props: MockAnalyticsProps) => null),
  speedInsights: vi.fn((_props: MockSpeedInsightsProps) => null)
}));

vi.mock("@vercel/analytics/react", () => ({
  Analytics: vendorMocks.analytics
}));

vi.mock("@vercel/speed-insights/react", () => ({
  SpeedInsights: vendorMocks.speedInsights
}));

beforeEach(() => {
  vendorMocks.analytics.mockClear();
  vendorMocks.speedInsights.mockClear();
  window.history.replaceState({}, "", "/");
});

describe("Vercel Public telemetry", () => {
  it.each([
    "/login",
    "/login/",
    "/activate-account",
    "/activate-account/?token=private",
    "/reset-password",
    "/reset-password/#token",
    "/admin",
    "/admin/",
    "/admin/content"
  ])("does not mount either vendor on %s", (pathname) => {
    const view = render(<VercelInsights pathname={pathname} />);

    expect(vendorMocks.analytics).not.toHaveBeenCalled();
    expect(vendorMocks.speedInsights).not.toHaveBeenCalled();
    view.unmount();
  });

  it("mounts both vendors with a normalized Public route", () => {
    render(<VercelInsights pathname="/news/?private=value#secret" />);

    expect(vendorMocks.analytics).toHaveBeenCalledTimes(1);
    expect(vendorMocks.analytics.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        beforeSend: sanitizeVercelAnalyticsEvent
      })
    );
    expect(vendorMocks.speedInsights).toHaveBeenCalledTimes(1);
    expect(vendorMocks.speedInsights.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        route: "/news",
        beforeSend: sanitizeVercelSpeedInsightEvent
      })
    );
  });

  it("uses sanitized auto tracking instead of StrictMode-sensitive manual route page views", () => {
    render(<VercelInsights pathname="/news" />);

    const analyticsProps = vendorMocks.analytics.mock.calls[0]?.[0];

    expect(analyticsProps.route).toBeUndefined();
    expect(analyticsProps.path).toBeUndefined();
    expect(analyticsProps.beforeSend).toBe(sanitizeVercelAnalyticsEvent);
  });

  it("removes query, hash, and token-like values from Vercel Analytics event URLs", () => {
    window.history.replaceState({}, "", "/news?current=private#current-secret");

    const sanitized = sanitizeVercelAnalyticsEvent({
      type: "pageview",
      url: "http://localhost:3000/news?token=RESET-TOKEN&email=admin%40example.invalid#INVITATION-TOKEN"
    });

    expect(sanitized).toEqual({
      type: "pageview",
      url: "http://localhost:3000/news"
    });
    expect(JSON.stringify(sanitized)).not.toMatch(/RESET-TOKEN|INVITATION-TOKEN|admin%40example\.invalid/u);
  });

  it("normalizes the Speed Insights URL and route", () => {
    window.history.replaceState({}, "", "/content/example?private=value#secret");

    expect(
      sanitizeVercelSpeedInsightEvent({
        type: "vital",
        url: "http://localhost:3000/content/example?token=private#hash",
        route: "/content/example?token=private"
      })
    ).toEqual({
      type: "vital",
      url: "http://localhost:3000/content/example",
      route: "/content/example"
    });
  });

  it("rejects private events and stale Public events after navigation becomes private", () => {
    window.history.replaceState({}, "", "/news");
    expect(
      sanitizeVercelAnalyticsEvent({
        type: "pageview",
        url: "http://localhost:3000/reset-password?token=private"
      })
    ).toBeNull();

    window.history.replaceState({}, "", "/login");
    expect(
      sanitizeVercelSpeedInsightEvent({
        type: "vital",
        url: "http://localhost:3000/news"
      })
    ).toBeNull();
  });
});
