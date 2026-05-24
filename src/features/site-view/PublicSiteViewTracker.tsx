import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { trackPublicSiteView } from "./siteViewTracking";

export function PublicSiteViewTracker() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    trackPublicSiteView(pathname);
  }, [pathname]);

  return null;
}
