import { getPublicSearchIndexSnapshotFromCloudflare } from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";

export function getPublicSearchIndexSnapshot(query = "", options: PublicReadRequestOptions = {}) {
  return getPublicSearchIndexSnapshotFromCloudflare(query, options);
}
