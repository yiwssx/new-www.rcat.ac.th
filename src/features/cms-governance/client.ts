import type { MediaAsset } from "../cms-media/types";
import type { ContentItem } from "../public-content/types";
import { requestCloudflareAdmin } from "../admin-write/cloudflareApi";

export interface ContentRevision {
  id: string;
  contentId: string;
  revision: number;
  reason: string;
  actor: string;
  createdAt: string;
  snapshot: ContentItem | null;
}

export interface ContentRevisionList {
  contentId: string;
  currentRevision: number;
  items: ContentRevision[];
}

export interface ContentPreviewSnapshot {
  item: ContentItem;
  media: MediaAsset[];
  generatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  generatedAt: string;
}

export interface MediaUsageItem {
  entityType: "content" | "document" | "event";
  id: string;
  title: string;
  detail: string;
}

export interface MediaUsageResult {
  mediaId: string;
  name: string;
  altText: string;
  count: number;
  items: MediaUsageItem[];
}

export type EditorialWorkflowStatus = "draft" | "review";

export interface EditorialContentItem {
  id: string;
  slug: string;
  type: string;
  status: string;
  owner: string;
  title: string;
  summary: string;
  updatedAt: string;
  publishAt: string;
  deletedAt: string;
  revision: number;
}

export interface ContentTrashSnapshot {
  items: EditorialContentItem[];
  generatedAt: string;
  maximumItems: number;
}

function revisionHeaders(revision: number | undefined) {
  return Number.isInteger(revision) && Number(revision) >= 0
    ? { "X-RCAT-Expected-Revision": String(revision) }
    : undefined;
}

function jsonMutation<T>(path: string, method: "POST" | "PUT" | "PATCH", body: unknown, revision?: number) {
  return requestCloudflareAdmin<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(revisionHeaders(revision) ?? {})
    },
    body: JSON.stringify(body)
  });
}

export function getContentRevisions(contentId: string) {
  return requestCloudflareAdmin<ContentRevisionList>(`/api/admin/content/${encodeURIComponent(contentId)}/revisions`);
}

export function getContentPreview(contentId: string) {
  return requestCloudflareAdmin<ContentPreviewSnapshot>(`/api/admin/content/${encodeURIComponent(contentId)}/preview`);
}

export async function restoreContentRevision(contentId: string, revision: number, expectedRevision?: number) {
  const response = await jsonMutation<{ item: ContentItem; restoredRevision: number }>(
    `/api/admin/content/${encodeURIComponent(contentId)}/revisions/${revision}/restore`,
    "POST",
    {},
    expectedRevision
  );
  return response.item;
}

export async function setContentUnpublishAt(contentId: string, unpublishAt: string, expectedRevision?: number) {
  const response = await jsonMutation<{ item: ContentItem }>(
    `/api/admin/content/${encodeURIComponent(contentId)}/expiry`,
    "PUT",
    { unpublishAt },
    expectedRevision
  );
  return response.item;
}

export async function setContentWorkflowStatus(
  contentId: string,
  status: EditorialWorkflowStatus,
  expectedRevision?: number
) {
  const response = await jsonMutation<{ item: EditorialContentItem }>(
    `/api/admin/content/${encodeURIComponent(contentId)}/workflow`,
    "PUT",
    { status },
    expectedRevision
  );
  return response.item;
}

export function getContentTrash() {
  return requestCloudflareAdmin<ContentTrashSnapshot>("/api/admin/content/trash");
}

export async function restoreContentFromTrash(contentId: string, expectedRevision?: number) {
  const response = await jsonMutation<{ item: EditorialContentItem }>(
    `/api/admin/content/${encodeURIComponent(contentId)}/restore`,
    "POST",
    {},
    expectedRevision
  );
  return response.item;
}

export function getAuditLog(
  input: {
    page?: number;
    pageSize?: number;
    entityType?: string;
    action?: string;
    actor?: string;
  } = {}
) {
  const search = new URLSearchParams();
  if (input.page) search.set("page", String(input.page));
  if (input.pageSize) search.set("pageSize", String(input.pageSize));
  if (input.entityType) search.set("entityType", input.entityType);
  if (input.action) search.set("action", input.action);
  if (input.actor) search.set("actor", input.actor);
  const suffix = search.size ? `?${search.toString()}` : "";
  return requestCloudflareAdmin<AuditLogPage>(`/api/admin/audit-log${suffix}`);
}

export function getMediaUsage(mediaId: string) {
  return requestCloudflareAdmin<MediaUsageResult>(`/api/admin/media/${encodeURIComponent(mediaId)}/usage`);
}

export async function updateMediaAltText(mediaId: string, altText: string) {
  return jsonMutation<{ id: string; altText: string; updatedAt: string }>(
    `/api/admin/media/${encodeURIComponent(mediaId)}/accessibility`,
    "PATCH",
    { altText }
  );
}
