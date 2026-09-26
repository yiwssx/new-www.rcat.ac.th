import { requestCloudflareAdmin } from "../admin-write/cloudflareApi";

export interface ContentRedirectItem {
  old_slug: string;
  new_slug: string;
  content_id: string;
  created_at: string;
  updated_at: string;
}

export interface ContentRedirectSnapshot {
  items: ContentRedirectItem[];
  generatedAt: string;
}

export interface TaxonomyUsageItem {
  label: string;
  count: number;
}

export interface TaxonomySnapshot {
  categories: TaxonomyUsageItem[];
  tags: TaxonomyUsageItem[];
  generatedAt: string;
  scope: string;
}

export interface ContentScopeItem {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "disabled";
  contentScope: string;
}

export interface ContentScopeSnapshot {
  items: ContentScopeItem[];
  generatedAt: string;
}

export interface BackupRecoveryResult {
  schemaVersion: number;
  mode: "merge";
  restoredRows: number;
  restoredCounts: Record<string, number>;
  completedAt: string;
}

function jsonMutation<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) {
  return requestCloudflareAdmin<T>(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function getContentRedirects() {
  return requestCloudflareAdmin<ContentRedirectSnapshot>("/api/admin/content-redirects");
}

export function saveContentRedirect(oldSlug: string, newSlug: string) {
  return jsonMutation<{ oldSlug: string; newSlug: string; contentId: string; updatedAt: string }>(
    "/api/admin/content-redirects",
    "POST",
    { oldSlug, newSlug }
  );
}

export function deleteContentRedirect(oldSlug: string) {
  return jsonMutation<{ oldSlug: string; deleted: boolean }>(
    `/api/admin/content-redirects/${encodeURIComponent(oldSlug)}`,
    "DELETE"
  );
}

export function getTaxonomySnapshot() {
  return requestCloudflareAdmin<TaxonomySnapshot>("/api/admin/taxonomy");
}

export function changeTaxonomy(kind: "category" | "tag", from: string, to: string) {
  return jsonMutation<TaxonomySnapshot & { kind: "category" | "tag"; from: string; to: string; affected: number }>(
    "/api/admin/taxonomy",
    "PATCH",
    { kind, from, to }
  );
}

export function getContentScopes() {
  return requestCloudflareAdmin<ContentScopeSnapshot>("/api/admin/content-scopes");
}

export function updateContentScope(userId: string, contentScope: string) {
  return jsonMutation<{ id: string; contentScope: string }>(
    `/api/admin/content-scopes/${encodeURIComponent(userId)}`,
    "PUT",
    { contentScope }
  );
}

export function recoverD1Backup(payload: unknown) {
  return jsonMutation<BackupRecoveryResult>("/api/admin/backup/recover", "POST", payload);
}
