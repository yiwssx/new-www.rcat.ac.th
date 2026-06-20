import { getPublicApiProvider } from "../../config/publicApiProvider";
import { getPublicHomeSnapshot as getPublicHomeSnapshotFromAppsScript } from "../../services/googleApi";
import { getPublicHomeSnapshotFromCloudflare } from "../public-read/cloudflareApi";

export function getPublicHomeSnapshot() {
  return getPublicApiProvider() === "cloudflare"
    ? getPublicHomeSnapshotFromCloudflare()
    : getPublicHomeSnapshotFromAppsScript();
}
