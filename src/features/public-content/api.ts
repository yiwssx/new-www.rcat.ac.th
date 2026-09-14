import type { PublicContentListSnapshot } from "../../types";
import {
  getContentDetailFromCloudflare,
  getPublicAnnouncementsContentListSnapshotFromCloudflare,
  getPublicContentDetailSnapshotFromCloudflare,
  getPublicContentListPageSnapshotFromCloudflare,
  getPublicContentListSnapshotFromCloudflare,
  isCloudflarePublicApiNotFoundError,
  type PublicContentListPageInput
} from "../public-read/cloudflareApi";
import { PublicReadError } from "../public-read/errors";
import { getPublicJson, type PublicReadRequestOptions } from "../public-read/request";
import type { PublicContentListKind } from "./types";

export type { PublicContentListPageInput } from "../public-read/cloudflareApi";

export interface PublicContentListFilterInput {
  tag?: string;
  category?: string;
}

function normalizeFilterValue(value: string | undefined) {
  return String(value || "")
    .trim()
    .slice(0, 120);
}

function hasFilters(filters: PublicContentListFilterInput | undefined) {
  return Boolean(normalizeFilterValue(filters?.tag) || normalizeFilterValue(filters?.category));
}

function buildFilteredContentListPath(
  kind: PublicContentListKind,
  pageInput: PublicContentListPageInput,
  filters: PublicContentListFilterInput
) {
  const search = new URLSearchParams({
    kind,
    page: String(Math.max(1, Math.floor(pageInput.page)))
  });
  const pageSize =
    pageInput.pageSize === undefined ? undefined : Math.min(100, Math.max(1, Math.floor(pageInput.pageSize)));
  const tag = normalizeFilterValue(filters.tag);
  const category = normalizeFilterValue(filters.category);

  if (pageSize !== undefined) search.set("pageSize", String(pageSize));
  if (tag) search.set("tag", tag);
  if (category) search.set("category", category);

  return `/api/public/content?${search.toString()}`;
}

async function getFilteredPublicContentListPageSnapshot(
  kind: PublicContentListKind,
  pageInput: PublicContentListPageInput,
  filters: PublicContentListFilterInput,
  options: PublicReadRequestOptions
): Promise<PublicContentListSnapshot> {
  const payload = await getPublicJson(buildFilteredContentListPath(kind, pageInput, filters), "content-list", options);

  if (
    payload.kind !== kind ||
    !Array.isArray(payload.items) ||
    !Array.isArray(payload.media) ||
    !Array.isArray(payload.menu) ||
    !payload.pagination ||
    typeof payload.pagination !== "object"
  ) {
    throw new PublicReadError("Cloudflare filtered content-list returned an invalid response", {
      kind: "invalid-response",
      resource: "content-list"
    });
  }

  return payload as unknown as PublicContentListSnapshot;
}

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
  options: PublicReadRequestOptions = {},
  filters?: PublicContentListFilterInput
) {
  if (hasFilters(filters)) {
    return getFilteredPublicContentListPageSnapshot(kind, pageInput, filters ?? {}, options);
  }

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
