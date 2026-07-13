import { keepPreviousData, queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getAdminCarouselList,
  getAdminCarouselOrder,
  getAdminContentList,
  getAdminDashboardSummary,
  getAdminDocumentList,
  getAdminDocumentOrder,
  getAdminEventList,
  getAdminExternalServiceList,
  getAdminExternalServiceOrder,
  getAdminMediaList,
  getAdminMenuList,
  getAdminMenuOrder,
  getAdminUserList,
  getAdminVisitorStatsSummary,
  normalizeAdminListRequest
} from "./api";
import type {
  AdminCarouselListRequest,
  AdminContentListRequest,
  AdminDocumentListRequest,
  AdminEventListRequest,
  AdminExternalServiceListRequest,
  AdminListEntity,
  AdminListRequest,
  AdminMediaListRequest,
  AdminMenuListRequest,
  AdminPaginationMetadata,
  AdminUserListRequest
} from "./types";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MEDIA_DEFAULT_PAGE_SIZE } from "./types";

type NormalizedAdminListRequest = AdminListRequest & Required<Pick<AdminListRequest, "page" | "pageSize">>;

export const adminListQueryKeys = {
  all: ["admin-lists"] as const,
  entity: (entity: AdminListEntity) => ["admin-lists", entity] as const,
  list: (entity: AdminListEntity, request: NormalizedAdminListRequest) => ["admin-lists", entity, request] as const,
  orders: ["admin-orders"] as const,
  order: (entity: Extract<AdminListEntity, "documents" | "menu" | "carousel" | "external-services">) =>
    ["admin-orders", entity] as const,
  dashboard: ["admin-dashboard-summary"] as const,
  visitorStats: ["admin-visitor-stats-summary"] as const
};

function createListQueryOptions<TRequest extends AdminListRequest, TResponse>(
  entity: AdminListEntity,
  request: TRequest,
  queryFn: (normalizedRequest: TRequest & Required<Pick<AdminListRequest, "page" | "pageSize">>) => Promise<TResponse>,
  defaultPageSize = ADMIN_DEFAULT_PAGE_SIZE
) {
  const normalizedRequest = normalizeAdminListRequest(request, defaultPageSize);

  return queryOptions({
    queryKey: adminListQueryKeys.list(entity, normalizedRequest),
    queryFn: () => queryFn(normalizedRequest),
    placeholderData: keepPreviousData
  });
}

export function adminContentListQueryOptions(request: AdminContentListRequest = {}) {
  return createListQueryOptions("content", request, getAdminContentList);
}

export function adminDocumentListQueryOptions(request: AdminDocumentListRequest = {}) {
  return createListQueryOptions("documents", request, getAdminDocumentList);
}

export function adminMediaListQueryOptions(request: AdminMediaListRequest = {}) {
  return createListQueryOptions("media", request, getAdminMediaList, ADMIN_MEDIA_DEFAULT_PAGE_SIZE);
}

export function adminEventListQueryOptions(request: AdminEventListRequest = {}) {
  return createListQueryOptions("events", request, getAdminEventList);
}

export function adminUserListQueryOptions(request: AdminUserListRequest = {}) {
  return createListQueryOptions("users", request, getAdminUserList);
}

export function adminCarouselListQueryOptions(request: AdminCarouselListRequest = {}) {
  return createListQueryOptions("carousel", request, getAdminCarouselList);
}

export function adminExternalServiceListQueryOptions(request: AdminExternalServiceListRequest = {}) {
  return createListQueryOptions("external-services", request, getAdminExternalServiceList);
}

export function adminMenuListQueryOptions(request: AdminMenuListRequest = {}) {
  return createListQueryOptions("menu", request, getAdminMenuList);
}

export function useAdminContentListQuery(request: AdminContentListRequest = {}) {
  return useQuery(adminContentListQueryOptions(request));
}

export function useAdminDocumentListQuery(request: AdminDocumentListRequest = {}) {
  return useQuery(adminDocumentListQueryOptions(request));
}

export function useAdminMediaListQuery(request: AdminMediaListRequest = {}) {
  return useQuery(adminMediaListQueryOptions(request));
}

export function useAdminEventListQuery(request: AdminEventListRequest = {}) {
  return useQuery(adminEventListQueryOptions(request));
}

export function useAdminUserListQuery(request: AdminUserListRequest = {}) {
  return useQuery(adminUserListQueryOptions(request));
}

export function useAdminCarouselListQuery(request: AdminCarouselListRequest = {}) {
  return useQuery(adminCarouselListQueryOptions(request));
}

export function useAdminExternalServiceListQuery(request: AdminExternalServiceListRequest = {}) {
  return useQuery(adminExternalServiceListQueryOptions(request));
}

export function useAdminMenuListQuery(request: AdminMenuListRequest = {}) {
  return useQuery(adminMenuListQueryOptions(request));
}

export const adminDocumentOrderQueryOptions = () =>
  queryOptions({
    queryKey: adminListQueryKeys.order("documents"),
    queryFn: getAdminDocumentOrder
  });

export const adminMenuOrderQueryOptions = () =>
  queryOptions({
    queryKey: adminListQueryKeys.order("menu"),
    queryFn: getAdminMenuOrder
  });

export const adminCarouselOrderQueryOptions = () =>
  queryOptions({
    queryKey: adminListQueryKeys.order("carousel"),
    queryFn: getAdminCarouselOrder
  });

export const adminExternalServiceOrderQueryOptions = () =>
  queryOptions({
    queryKey: adminListQueryKeys.order("external-services"),
    queryFn: getAdminExternalServiceOrder
  });

export const adminDashboardSummaryQueryOptions = () =>
  queryOptions({
    queryKey: adminListQueryKeys.dashboard,
    queryFn: getAdminDashboardSummary
  });

export const adminVisitorStatsSummaryQueryOptions = () =>
  queryOptions({
    queryKey: adminListQueryKeys.visitorStats,
    queryFn: getAdminVisitorStatsSummary
  });

export function invalidateAdminListQueries(queryClient: QueryClient, entity: AdminListEntity) {
  return queryClient.invalidateQueries({ queryKey: adminListQueryKeys.entity(entity) });
}

export function getAdminPageAfterDelete(
  pagination: Pick<AdminPaginationMetadata, "page" | "pageSize" | "totalItems">,
  deletedItems = 1
) {
  const remainingItems = Math.max(0, pagination.totalItems - Math.max(0, Math.floor(deletedItems)));
  const remainingPages = Math.ceil(remainingItems / Math.max(1, pagination.pageSize));
  return Math.min(Math.max(1, pagination.page), Math.max(1, remainingPages));
}
