import { getAdminCmsSnapshotFromCloudflare } from "../admin-write/cloudflareApi";
import type { CmsSnapshot } from "../../types";

export async function getAdminCmsSnapshot(): Promise<CmsSnapshot> {
  return getAdminCmsSnapshotFromCloudflare();
}
