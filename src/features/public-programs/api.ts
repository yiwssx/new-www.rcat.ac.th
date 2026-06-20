import { getPublicApiProvider } from "../../config/publicApiProvider";
import { getPublicProgramListSnapshot as getPublicProgramListSnapshotFromAppsScript } from "../../services/googleApi";
import { getPublicProgramListSnapshotFromCloudflare } from "../public-read/cloudflareApi";

export function getPublicProgramListSnapshot() {
  return getPublicApiProvider() === "cloudflare"
    ? getPublicProgramListSnapshotFromCloudflare()
    : getPublicProgramListSnapshotFromAppsScript();
}
