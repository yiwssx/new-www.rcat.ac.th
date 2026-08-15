import {
  getPublicHomeSnapshotFromCloudflare,
  getPublicShellSnapshotFromCloudflare,
  isCloudflarePublicApiNotFoundError
} from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";
import type { PublicShellSnapshot } from "../../types";

export async function getPublicShellSnapshot(options: PublicReadRequestOptions = {}): Promise<PublicShellSnapshot> {
  try {
    return await getPublicShellSnapshotFromCloudflare(options);
  } catch (error) {
    // Deployment-order bridge only: an older Worker can still expose shell fields
    // through its pre-P5 home contract. The P5 Worker owns these fields exclusively
    // at /api/public/shell, so this path disappears naturally after cutover.
    if (!isCloudflarePublicApiNotFoundError(error)) {
      throw error;
    }

    const legacyHome = await getPublicHomeSnapshotFromCloudflare(options);
    return {
      siteSettings: legacyHome.siteSettings,
      homepageSettings: legacyHome.homepageSettings,
      displaySettings: legacyHome.displaySettings,
      menu: legacyHome.menu,
      generatedAt: legacyHome.generatedAt
    };
  }
}
