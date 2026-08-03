import {
  getPublicSearchIndexSnapshotFromCloudflare,
  getPublicSearchPageSnapshotFromCloudflare,
  type PublicSearchPageInput
} from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";

export function getPublicSearchIndexSnapshot(query = "", options: PublicReadRequestOptions = {}) {
  return getPublicSearchIndexSnapshotFromCloudflare(query, options);
}

export function getPublicSearchPageSnapshot(
  query: string,
  pageInput: PublicSearchPageInput,
  options: PublicReadRequestOptions = {}
) {
  return getPublicSearchPageSnapshotFromCloudflare(query, pageInput, options);
}

export type { PublicSearchPageInput };
