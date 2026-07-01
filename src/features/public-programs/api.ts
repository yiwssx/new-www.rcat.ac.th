import { getPublicProgramListSnapshotFromCloudflare } from "../public-read/cloudflareApi";

export function getPublicProgramListSnapshot() {
  return getPublicProgramListSnapshotFromCloudflare();
}
