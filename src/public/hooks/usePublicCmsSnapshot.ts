import type { CmsSnapshot } from "../../types";
import { getPublicCmsSnapshotForProvider } from "../../features/public-read/cmsSnapshot";
import { usePublicShellSnapshot } from "./usePublicShellSnapshot";

interface UsePublicCmsSnapshotOptions {
  enabled?: boolean;
}

export { getPublicCmsSnapshotForProvider };

/**
 * Legacy compatibility hook for components that still read shell fields from a
 * CmsSnapshot-shaped object. It deliberately delegates to the canonical
 * public-shell query so menu/settings freshness has one runtime owner.
 */
export function usePublicCmsSnapshot(options: UsePublicCmsSnapshotOptions = {}) {
  const query = usePublicShellSnapshot(options);
  const shell = query.data;
  const data: CmsSnapshot | undefined = shell
    ? {
        metrics: [],
        content: [],
        media: [],
        events: [],
        menu: shell.menu,
        displaySettings: shell.displaySettings,
        siteSettings: shell.siteSettings,
        homepageSettings: shell.homepageSettings
      }
    : undefined;

  return {
    ...query,
    data
  };
}
