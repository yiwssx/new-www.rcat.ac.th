import { lazy, Suspense } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { SilentTelemetryBoundary } from "../../shared/telemetry/SilentTelemetryBoundary";
import PublicSiteShell from "./PublicSiteShell";

const PublicTelemetry = lazy(() => import("../../shared/telemetry/PublicTelemetry"));

export default function PublicShellRouteLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <>
      <PublicSiteShell routeLayout routePathname={pathname}>
        <Outlet />
      </PublicSiteShell>
      <SilentTelemetryBoundary>
        <Suspense fallback={null}>
          <PublicTelemetry />
        </Suspense>
      </SilentTelemetryBoundary>
    </>
  );
}
