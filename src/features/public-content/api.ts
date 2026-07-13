import {
  getContentDetailFromCloudflare,
  getPublicContentListSnapshotFromCloudflare,
  isCloudflarePublicApiNotFoundError
} from "../public-read/cloudflareApi";
import type { PublicContentListKind } from "./types";

export function getPublicContentListSnapshot(kind: PublicContentListKind) {
  return getPublicContentListSnapshotFromCloudflare(kind);
}

export function getContentDetail(input: { id?: string; slug?: string }) {
  return getContentDetailFromCloudflare(input);
}

export function isPublicContentNotFoundError(error: unknown) {
  return isCloudflarePublicApiNotFoundError(error);
}
