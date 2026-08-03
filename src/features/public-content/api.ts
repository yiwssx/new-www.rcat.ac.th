import {
  getContentDetailFromCloudflare,
  getPublicContentListSnapshotFromCloudflare,
  isCloudflarePublicApiNotFoundError
} from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";
import type { PublicContentListKind } from "./types";

export function getPublicContentListSnapshot(
  kind: PublicContentListKind,
  options: PublicReadRequestOptions = {}
) {
  return getPublicContentListSnapshotFromCloudflare(kind, options);
}

export function getContentDetail(input: { id?: string; slug?: string }, options: PublicReadRequestOptions = {}) {
  return getContentDetailFromCloudflare(input, options);
}

export function isPublicContentNotFoundError(error: unknown) {
  return isCloudflarePublicApiNotFoundError(error);
}
