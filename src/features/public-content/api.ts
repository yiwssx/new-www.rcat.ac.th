import {
  getContentDetailFromCloudflare,
  getPublicAnnouncementsContentListSnapshotFromCloudflare,
  getPublicContentDetailSnapshotFromCloudflare,
  getPublicContentListPageSnapshotFromCloudflare,
  getPublicContentListSnapshotFromCloudflare,
  isCloudflarePublicApiNotFoundError,
  type PublicContentListPageInput
} from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";
import type { PublicContentListKind } from "./types";

export type { PublicContentListPageInput } from "../public-read/cloudflareApi";

export function getPublicContentListSnapshot(kind: PublicContentListKind, options: PublicReadRequestOptions = {}) {
  return getPublicContentListSnapshotFromCloudflare(kind, options);
}

export function getPublicAnnouncementsContentListSnapshot(
  pageItemsInput: PublicContentListPageInput,
  options: PublicReadRequestOptions = {}
) {
  return getPublicAnnouncementsContentListSnapshotFromCloudflare(pageItemsInput, options);
}

export function getPublicContentListPageSnapshot(
  kind: PublicContentListKind,
  pageInput: PublicContentListPageInput,
  options: PublicReadRequestOptions = {}
) {
  return getPublicContentListPageSnapshotFromCloudflare(kind, pageInput, options);
}

export function getPublicContentDetailSnapshot(
  input: { id?: string; slug?: string },
  options: PublicReadRequestOptions = {}
) {
  return getPublicContentDetailSnapshotFromCloudflare(input, options);
}

export function getContentDetail(input: { id?: string; slug?: string }, options: PublicReadRequestOptions = {}) {
  return getContentDetailFromCloudflare(input, options);
}

export function isPublicContentNotFoundError(error: unknown) {
  return isCloudflarePublicApiNotFoundError(error);
}
