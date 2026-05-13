import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useRouterState } from "@tanstack/react-router";
import { isPublicAnalyticsPath } from "../utils/publicAnalytics";

export function VercelInsights() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!isPublicAnalyticsPath(pathname)) {
    return null;
  }

  return (
    <>
      <Analytics route={pathname} />
      <SpeedInsights route={pathname} />
    </>
  );
}
