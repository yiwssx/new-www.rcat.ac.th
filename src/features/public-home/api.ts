import { getPublicHomeSnapshotFromCloudflare } from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";

export function getPublicHomeSnapshot(options: PublicReadRequestOptions = {}) {
  return getPublicHomeSnapshotFromCloudflare(options);
}
