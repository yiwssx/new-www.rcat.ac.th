import { useEffect } from "react";
import { releasePublicPageView, trackPublicPageView } from "../utils/publicAnalytics";

export function PublicAnalytics({ pathname }: { pathname: string }) {
  useEffect(() => {
    trackPublicPageView(pathname);

    return releasePublicPageView;
  }, [pathname]);

  return null;
}
