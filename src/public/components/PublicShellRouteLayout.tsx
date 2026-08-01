import { lazy, Suspense } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { SilentTelemetryBoundary } from "../../shared/telemetry/SilentTelemetryBoundary";
import PublicSiteShell from "./PublicSiteShell";

declare global {
  interface Window {
    __RCAT_FUNCTIONAL_FAIL_PUBLIC_TELEMETRY_IMPORT__?: boolean;
    __RCAT_FUNCTIONAL_PUBLIC_TELEMETRY_FAILURE_TRIGGERED__?: boolean;
  }
}

function loadPublicTelemetry() {
  if (import.meta.env.DEV && typeof window !== "undefined" && window.__RCAT_FUNCTIONAL_FAIL_PUBLIC_TELEMETRY_IMPORT__) {
    window.__RCAT_FUNCTIONAL_PUBLIC_TELEMETRY_FAILURE_TRIGGERED__ = true;
    return Promise.reject(new Error("Synthetic optional telemetry module failure"));
  }

  return import("../../shared/telemetry/PublicTelemetry");
}

const PublicTelemetry = lazy(loadPublicTelemetry);

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
