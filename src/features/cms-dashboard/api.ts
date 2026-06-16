import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import { getAdminCmsSnapshotFromCloudflare } from "../admin-write/cloudflareApi";
import { getAdminCmsSnapshot as getAdminCmsSnapshotFromAppsScript } from "../../services/googleApi";
import type { CmsSnapshot } from "../../types";

export async function getAdminCmsSnapshot(): Promise<CmsSnapshot> {
  return getAdminWriteProvider() === "cloudflare"
    ? getAdminCmsSnapshotFromCloudflare()
    : getAdminCmsSnapshotFromAppsScript();
}
