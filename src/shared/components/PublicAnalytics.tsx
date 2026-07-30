import { useEffect } from "react";
import { retainPublicPageView, trackPublicPageView } from "../utils/publicAnalytics";

export function PublicAnalytics({ pathname }: { pathname: string }) {
  useEffect(() => {
    const release = retainPublicPageView();
    trackPublicPageView(pathname);

    return release;
  }, [pathname]);

  return null;
}
