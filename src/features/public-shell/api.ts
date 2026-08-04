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
    if (!isCloudflarePublicApiNotFoundError(error)) {
      throw error;
    }

    const home = await getPublicHomeSnapshotFromCloudflare(options);
    return {
      siteSettings: home.siteSettings,
      homepageSettings: home.homepageSettings,
      displaySettings: home.displaySettings,
      menu: home.menu,
      generatedAt: home.generatedAt
    };
  }
}
