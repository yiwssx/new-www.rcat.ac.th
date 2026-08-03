import { getPublicSearchIndexSnapshotFromCloudflare } from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";

export function getPublicSearchIndexSnapshot(options: PublicReadRequestOptions = {}) {
  return getPublicSearchIndexSnapshotFromCloudflare(options);
}
