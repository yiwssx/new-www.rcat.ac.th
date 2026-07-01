import { getPublicHomeSnapshotFromCloudflare } from "../public-read/cloudflareApi";

export function getPublicHomeSnapshot() {
  return getPublicHomeSnapshotFromCloudflare();
}
