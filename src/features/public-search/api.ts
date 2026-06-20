import { getPublicApiProvider } from "../../config/publicApiProvider";
import { getPublicSearchIndexSnapshot as getPublicSearchIndexSnapshotFromAppsScript } from "../../services/googleApi";
import { getPublicSearchIndexSnapshotFromCloudflare } from "../public-read/cloudflareApi";

export function getPublicSearchIndexSnapshot() {
  return getPublicApiProvider() === "cloudflare"
    ? getPublicSearchIndexSnapshotFromCloudflare()
    : getPublicSearchIndexSnapshotFromAppsScript();
}
