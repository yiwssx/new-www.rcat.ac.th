import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { isPublicTelemetryPath, normalizePublicTelemetryPath } from "../telemetry/publicTelemetryRoutes";
import { sanitizeVercelAnalyticsEvent, sanitizeVercelSpeedInsightEvent } from "../telemetry/vercelTelemetryPrivacy";

export function VercelInsights({ pathname }: { pathname: string }) {
  const normalizedPath = normalizePublicTelemetryPath(pathname);

  if (!isPublicTelemetryPath(normalizedPath)) {
    return null;
  }

  return (
    <>
      <Analytics beforeSend={sanitizeVercelAnalyticsEvent} />
      <SpeedInsights route={normalizedPath} beforeSend={sanitizeVercelSpeedInsightEvent} />
    </>
  );
}
