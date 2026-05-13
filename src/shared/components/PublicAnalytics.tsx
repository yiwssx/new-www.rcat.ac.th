import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { trackPublicPageView } from "../utils/publicAnalytics";

export function PublicAnalytics() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    trackPublicPageView(pathname);
  }, [pathname]);

  return null;
}
