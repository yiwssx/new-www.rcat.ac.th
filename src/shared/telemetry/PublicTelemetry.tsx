import { useRouterState } from "@tanstack/react-router";
import { PublicSiteViewTracker } from "../../features/site-view/PublicSiteViewTracker";
import { PublicAnalytics } from "../components/PublicAnalytics";
import { VercelInsights } from "../components/VercelInsights";
import { isPublicTelemetryPath, normalizePublicTelemetryPath } from "./publicTelemetryRoutes";

export default function PublicTelemetry() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!isPublicTelemetryPath(pathname)) {
    return null;
  }

  const normalizedPath = normalizePublicTelemetryPath(pathname);

  return (
    <>
      <PublicAnalytics pathname={normalizedPath} />
      <PublicSiteViewTracker />
      <VercelInsights pathname={normalizedPath} />
    </>
  );
}
