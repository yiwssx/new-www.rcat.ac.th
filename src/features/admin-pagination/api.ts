import { requestCloudflareAdmin } from "../admin-write/cloudflareApi";
import type {
  AdminCarouselListItem,
  AdminCarouselListRequest,
  AdminCarouselOrderInput,
  AdminCarouselOrderItem,
  AdminContentListItem,
  AdminContentListRequest,
  AdminDashboardSummary,
  AdminDocumentListItem,
  AdminDocumentListRequest,
  AdminDocumentOrderInput,
  AdminDocumentOrderItem,
  AdminEventListItem,
  AdminEventListRequest,
  AdminExternalServiceListItem,
  AdminExternalServiceListRequest,
  AdminExternalServiceOrderInput,
  AdminExternalServiceOrderItem,
  AdminItemsResponse,
  AdminListRequest,
  AdminMediaListItem,
  AdminMediaListRequest,
  AdminMenuListItem,
  AdminMenuListRequest,
  AdminMenuItemInput,
  AdminMenuOrderInput,
  AdminMenuOrderItem,
  AdminPaginatedResponse,
  AdminPublishPendingResult,
  AdminUserListItem,
  AdminUserListRequest,
  AdminVisitorStatsSummary
} from "./types";
import {
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_MAX_PAGE_SIZE,
  ADMIN_MEDIA_BY_IDS_MAX,
  ADMIN_MEDIA_DEFAULT_PAGE_SIZE
} from "./types";

type AdminQueryValue = string | number | boolean | null | undefined;

function normalizePositiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeAdminListRequest<T extends AdminListRequest>(
  request: T,
  defaultPageSize = ADMIN_DEFAULT_PAGE_SIZE
): T & Required<Pick<AdminListRequest, "page" | "pageSize">> {
  const page = normalizePositiveInteger(request.page, 1);
  const pageSize = Math.min(normalizePositiveInteger(request.pageSize, defaultPageSize), ADMIN_MAX_PAGE_SIZE);
  const normalizedEntries = Object.entries(request).filter(([, value]) => value !== undefined && value !== null);

  return {
    ...(Object.fromEntries(normalizedEntries) as T),
    page,
    pageSize
  };
}

export function buildAdminListPath(
  path: string,
  request: AdminListRequest & Record<string, AdminQueryValue>,
  defaultPageSize = ADMIN_DEFAULT_PAGE_SIZE
) {
  const normalized = normalizeAdminListRequest(request, defaultPageSize);
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(normalized)) {
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      continue;
    }

    if (key === "q" && typeof value === "string") {
      searchParams.set(key, value.trim());
    } else {
      searchParams.set(key, String(value));
    }
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${searchParams.toString()}`;
}

function requestAdminList<TItem, TRequest extends AdminListRequest>(
  path: string,
  request: TRequest,
  defaultPageSize = ADMIN_DEFAULT_PAGE_SIZE
) {
  return requestCloudflareAdmin<AdminPaginatedResponse<TItem>>(
    buildAdminListPath(path, request as TRequest & Record<string, AdminQueryValue>, defaultPageSize)
  );
}

export function getAdminContentList(request: AdminContentListRequest = {}) {
  return requestAdminList<AdminContentListItem, AdminContentListRequest>("/api/admin/content", request);
}

export function getAdminDocumentList(request: AdminDocumentListRequest = {}) {
  return requestAdminList<AdminDocumentListItem, AdminDocumentListRequest>("/api/admin/documents", request);
}

export function getAdminMediaList(request: AdminMediaListRequest = {}) {
  return requestAdminList<AdminMediaListItem, AdminMediaListRequest>(
    "/api/admin/media",
    request,
    ADMIN_MEDIA_DEFAULT_PAGE_SIZE
  );
}

export function getAdminEventList(request: AdminEventListRequest = {}) {
  return requestAdminList<AdminEventListItem, AdminEventListRequest>("/api/admin/events", request);
}

export function getAdminUserList(request: AdminUserListRequest = {}) {
  return requestAdminList<AdminUserListItem, AdminUserListRequest>("/api/admin/users", request);
}

export function getAdminCarouselList(request: AdminCarouselListRequest = {}) {
  return requestAdminList<AdminCarouselListItem, AdminCarouselListRequest>("/api/admin/carousel", request);
}

export function getAdminExternalServiceList(request: AdminExternalServiceListRequest = {}) {
  return requestAdminList<AdminExternalServiceListItem, AdminExternalServiceListRequest>(
    "/api/admin/external-services",
    request
  );
}

export function getAdminMenuList(request: AdminMenuListRequest = {}) {
  return requestAdminList<AdminMenuListItem, AdminMenuListRequest>("/api/admin/menu", request);
}

export async function saveAdminMenuItem(input: AdminMenuItemInput) {
  const { id, revision, ...body } = input;
  const response = await requestCloudflareAdmin<{ item: AdminMenuListItem }>(
    id ? `/api/admin/menu/${encodeURIComponent(id)}` : "/api/admin/menu",
    {
      method: id ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(Number.isInteger(revision) && Number(revision) >= 0 ? { "X-RCAT-Expected-Revision": String(revision) } : {})
      },
      body: JSON.stringify(body)
    }
  );
  return response.item;
}

export function deleteAdminMenuItem(input: Pick<AdminMenuListItem, "id" | "revision">) {
  return requestCloudflareAdmin<{ id: string; deleted: boolean }>(`/api/admin/menu/${encodeURIComponent(input.id)}`, {
    method: "DELETE",
    headers:
      Number.isInteger(input.revision) && Number(input.revision) >= 0
        ? { "X-RCAT-Expected-Revision": String(input.revision) }
        : undefined
  });
}

export async function getAdminMediaByIds(ids: readonly string[]) {
  const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

  if (normalizedIds.length === 0) {
    return [];
  }

  if (normalizedIds.length > ADMIN_MEDIA_BY_IDS_MAX) {
    throw new Error(`A maximum of ${ADMIN_MEDIA_BY_IDS_MAX} media ids may be requested at once`);
  }

  const searchParams = new URLSearchParams({ ids: normalizedIds.join(",") });
  const response = await requestCloudflareAdmin<AdminItemsResponse<AdminMediaListItem>>(
    `/api/admin/media/by-ids?${searchParams.toString()}`
  );
  return response.items;
}

async function requestAdminOrder<T>(path: string) {
  const response = await requestCloudflareAdmin<AdminItemsResponse<T>>(path);
  return response.items;
}

async function saveAdminOrder<TInput, TOutput>(path: string, items: readonly TInput[]) {
  const response = await requestCloudflareAdmin<AdminItemsResponse<TOutput>>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items })
  });
  return response.items;
}

export function getAdminDocumentOrder() {
  return requestAdminOrder<AdminDocumentOrderItem>("/api/admin/documents/order");
}

export function getAdminMenuOrder() {
  return requestAdminOrder<AdminMenuOrderItem>("/api/admin/menu/order");
}

export function getAdminCarouselOrder() {
  return requestAdminOrder<AdminCarouselOrderItem>("/api/admin/carousel/order");
}

export function getAdminExternalServiceOrder() {
  return requestAdminOrder<AdminExternalServiceOrderItem>("/api/admin/external-services/order");
}

export function saveAdminDocumentOrder(items: readonly AdminDocumentOrderInput[]) {
  const payload = items.map(({ id, order, pinned, revision }) => ({ id, order, pinned, revision }));
  return saveAdminOrder<AdminDocumentOrderInput, AdminDocumentOrderItem>("/api/admin/documents/order", payload);
}

export function saveAdminMenuOrder(items: readonly AdminMenuOrderInput[]) {
  const payload = items.map(({ id, parentId, order, enabled, revision }) => ({
    id,
    parentId,
    order,
    enabled,
    revision
  }));
  return saveAdminOrder<AdminMenuOrderInput, AdminMenuOrderItem>("/api/admin/menu/order", payload);
}

export function saveAdminCarouselOrder(items: readonly AdminCarouselOrderInput[]) {
  const payload = items.map(({ id, order, enabled, revision }) => ({ id, order, enabled, revision }));
  return saveAdminOrder<AdminCarouselOrderInput, AdminCarouselOrderItem>("/api/admin/carousel/order", payload);
}

export function saveAdminExternalServiceOrder(items: readonly AdminExternalServiceOrderInput[]) {
  const payload = items.map(({ id, order, enabled, revision }) => ({ id, order, enabled, revision }));
  return saveAdminOrder<AdminExternalServiceOrderInput, AdminExternalServiceOrderItem>(
    "/api/admin/external-services/order",
    payload
  );
}

export function getAdminDashboardSummary() {
  return requestCloudflareAdmin<AdminDashboardSummary>("/api/admin/dashboard-summary");
}

export function getAdminVisitorStatsSummary() {
  return requestCloudflareAdmin<AdminVisitorStatsSummary>("/api/admin/visitor-stats/summary");
}

export function publishAllPendingAdminContent() {
  return requestCloudflareAdmin<AdminPublishPendingResult>("/api/admin/content/publish-pending", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
}

export const getAdminContentListFromCloudflare = getAdminContentList;
export const getAdminDocumentListFromCloudflare = getAdminDocumentList;
export const getAdminMediaListFromCloudflare = getAdminMediaList;
export const getAdminEventListFromCloudflare = getAdminEventList;
export const getAdminUserListFromCloudflare = getAdminUserList;
export const getAdminCarouselListFromCloudflare = getAdminCarouselList;
export const getAdminExternalServiceListFromCloudflare = getAdminExternalServiceList;
export const getAdminMenuListFromCloudflare = getAdminMenuList;
