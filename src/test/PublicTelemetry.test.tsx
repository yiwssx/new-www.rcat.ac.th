import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicTelemetry from "../shared/telemetry/PublicTelemetry";

const telemetryMocks = vi.hoisted(() => ({
  pathname: "/",
  analytics: vi.fn((_props: { pathname: string }) => <span data-testid="google-analytics" />),
  siteView: vi.fn(() => <span data-testid="site-view" />),
  vercel: vi.fn((_props: { pathname: string }) => <span data-testid="vercel-telemetry" />)
}));

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: telemetryMocks.pathname } })
}));

vi.mock("../shared/components/PublicAnalytics", () => ({
  PublicAnalytics: telemetryMocks.analytics
}));

vi.mock("../features/site-view/PublicSiteViewTracker", () => ({
  PublicSiteViewTracker: telemetryMocks.siteView
}));

vi.mock("../shared/components/VercelInsights", () => ({
  VercelInsights: telemetryMocks.vercel
}));

beforeEach(() => {
  telemetryMocks.pathname = "/";
  telemetryMocks.analytics.mockClear();
  telemetryMocks.siteView.mockClear();
  telemetryMocks.vercel.mockClear();
});

describe("PublicTelemetry", () => {
  it.each(["/login", "/activate-account/?token=private", "/reset-password/#token", "/admin", "/admin/users"])(
    "does not mount any telemetry implementation on %s",
    (pathname) => {
      telemetryMocks.pathname = pathname;
      render(<PublicTelemetry />);

      expect(telemetryMocks.analytics).not.toHaveBeenCalled();
      expect(telemetryMocks.siteView).not.toHaveBeenCalled();
      expect(telemetryMocks.vercel).not.toHaveBeenCalled();
      expect(screen.queryByTestId("google-analytics")).not.toBeInTheDocument();
      expect(screen.queryByTestId("site-view")).not.toBeInTheDocument();
      expect(screen.queryByTestId("vercel-telemetry")).not.toBeInTheDocument();
    }
  );

  it("mounts every telemetry owner with one normalized Public path", () => {
    telemetryMocks.pathname = "/news/?private=value#secret";
    render(<PublicTelemetry />);

    expect(screen.getByTestId("google-analytics")).toBeInTheDocument();
    expect(screen.getByTestId("site-view")).toBeInTheDocument();
    expect(screen.getByTestId("vercel-telemetry")).toBeInTheDocument();
    expect(telemetryMocks.analytics.mock.calls[0]?.[0]).toEqual({ pathname: "/news" });
    expect(telemetryMocks.vercel.mock.calls[0]?.[0]).toEqual({ pathname: "/news" });
  });
});
