import { getPublicProgramListSnapshotFromCloudflare } from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";

export function getPublicProgramListSnapshot(options: PublicReadRequestOptions = {}) {
  return getPublicProgramListSnapshotFromCloudflare(options);
}
