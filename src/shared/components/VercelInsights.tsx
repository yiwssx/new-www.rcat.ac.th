import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useRouterState } from "@tanstack/react-router";

export function VercelInsights() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <>
      <Analytics route={pathname} />
      <SpeedInsights route={pathname} />
    </>
  );
}
