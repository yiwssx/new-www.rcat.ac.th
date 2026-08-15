import { getPublicShellSnapshotFromCloudflare } from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";
import type { PublicShellSnapshot } from "../../types";

export function getPublicShellSnapshot(options: PublicReadRequestOptions = {}): Promise<PublicShellSnapshot> {
  return getPublicShellSnapshotFromCloudflare(options);
}
