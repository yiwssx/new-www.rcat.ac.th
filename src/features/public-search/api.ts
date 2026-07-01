import { getPublicSearchIndexSnapshotFromCloudflare } from "../public-read/cloudflareApi";

export function getPublicSearchIndexSnapshot() {
  return getPublicSearchIndexSnapshotFromCloudflare();
}
