import type { CarouselSlide } from "../cms-carousel/types";
import type { CmsDocumentItem, DocumentStatus } from "../cms-documents/types";
import type { CalendarEvent } from "../cms-events/types";
import type { ExternalServiceLink } from "../cms-external-services/types";
import type { ExternalServiceTone } from "../cms-external-services/types";
import type { MediaAsset, MediaType } from "../cms-media/types";
import type { PublicMenuItem } from "../cms-navigation/types";
import type { DashboardMetric } from "../cms-dashboard/types";
import type { ContentItem, ContentStatus, ContentType } from "../public-content/types";
import type { AdminUserProfile } from "../admin-write/cloudflareApi";
import type { VisitorStatsSettings } from "../visitor-stats/types";

export const ADMIN_DEFAULT_PAGE_SIZE = 25;
export const ADMIN_MEDIA_DEFAULT_PAGE_SIZE = 24;
export const ADMIN_MAX_PAGE_SIZE = 100;
export const ADMIN_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const ADMIN_MEDIA_PAGE_SIZE_OPTIONS = [24, 48, 96] as const;
export const ADMIN_MEDIA_BY_IDS_MAX = 50;

export type AdminSortDirection = "asc" | "desc";

export type AdminListEntity =
  "content" | "documents" | "media" | "events" | "users" | "carousel" | "external-services" | "menu";

export interface AdminPaginationMetadata {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AdminPaginatedResponse<T> {
  items: T[];
  pagination: AdminPaginationMetadata;
  generatedAt: string;
}

export interface AdminItemsResponse<T> {
  items: T[];
  generatedAt?: string;
}

export interface AdminListRequest {
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: string;
  sortDirection?: AdminSortDirection;
}

export interface AdminContentListRequest extends AdminListRequest {
  status?: ContentStatus | "all";
  type?: ContentType | "all";
  category?: string;
  owner?: string;
  featured?: boolean | "all";
}

export interface AdminDocumentListRequest extends AdminListRequest {
  status?: DocumentStatus | "all";
  pinned?: boolean | "all" | "pinned" | "unpinned";
  category?: string;
}

export interface AdminMediaListRequest extends AdminListRequest {
  type?: MediaType | "all";
}

export interface AdminEventListRequest extends AdminListRequest {
  status?: CalendarEvent["status"] | "all";
  visibility?: NonNullable<CalendarEvent["visibility"]> | "all";
  category?: string;
}

export interface AdminUserListRequest extends AdminListRequest {
  role?: AdminUserProfile["role"] | "all";
  status?: AdminUserProfile["status"] | "all";
}

export interface AdminCarouselListRequest extends AdminListRequest {
  enabled?: boolean | "all";
}

export interface AdminExternalServiceListRequest extends AdminListRequest {
  enabled?: boolean | "all";
  tone?: ExternalServiceTone | "all";
}

export interface AdminMenuListRequest extends AdminListRequest {
  enabled?: boolean | "all";
  parentId?: string;
  parentRoot?: boolean;
}

export type AdminContentListItem = Pick<
  ContentItem,
  | "id"
  | "title"
  | "slug"
  | "type"
  | "status"
  | "owner"
  | "summary"
  | "category"
  | "template"
  | "canonicalUrl"
  | "featured"
  | "featuredMediaId"
  | "viewCount"
  | "lastViewedAt"
  | "updatedAt"
  | "publishAt"
  | "revision"
>;
export type AdminDocumentListItem = CmsDocumentItem;
export type AdminMediaListItem = MediaAsset;
export type AdminEventListItem = CalendarEvent;
export type AdminUserListItem = AdminUserProfile;
export type AdminCarouselListItem = CarouselSlide;
export type AdminExternalServiceListItem = ExternalServiceLink;

export interface AdminMenuListItem extends Omit<PublicMenuItem, "children"> {
  parentId: string | null;
  order: number;
  updatedAt: string;
  revision?: number;
}

export type AdminMenuItemInput = Pick<AdminMenuListItem, "label" | "href"> &
  Partial<Pick<AdminMenuListItem, "id" | "parentId" | "order" | "enabled" | "revision">>;

export type AdminDocumentOrderItem = Pick<CmsDocumentItem, "id" | "title" | "order" | "pinned"> & {
  revision: number;
};
export type AdminCarouselOrderItem = Pick<CarouselSlide, "id" | "title" | "order" | "enabled"> & {
  revision: number;
};
export type AdminExternalServiceOrderItem = Pick<ExternalServiceLink, "id" | "title" | "order" | "enabled"> & {
  revision: number;
};

export interface AdminMenuOrderItem {
  id: string;
  label: string;
  order: number;
  enabled: boolean;
  parentId: string | null;
  revision: number;
}

export type AdminDocumentOrderInput = Pick<AdminDocumentOrderItem, "id" | "order" | "pinned" | "revision">;
export type AdminCarouselOrderInput = Pick<AdminCarouselOrderItem, "id" | "order" | "enabled" | "revision">;
export type AdminExternalServiceOrderInput = Pick<
  AdminExternalServiceOrderItem,
  "id" | "order" | "enabled" | "revision"
>;
export type AdminMenuOrderInput = Pick<AdminMenuOrderItem, "id" | "parentId" | "order" | "enabled" | "revision">;

export type AdminDashboardCountValue = number | Record<string, number>;

export interface AdminDashboardSummary {
  counts: Record<string, AdminDashboardCountValue>;
  publishableCount: number;
  metrics: DashboardMetric[];
  content: AdminContentListItem[];
  recentContent: AdminContentListItem[];
  documents: AdminDocumentListItem[];
  recentDocuments: AdminDocumentListItem[];
  events: AdminEventListItem[];
  recentEvents: AdminEventListItem[];
  generatedAt: string;
}

export type AdminVisitorStatsSummary = VisitorStatsSettings;

export interface AdminPublishPendingResult {
  publishedCount: number;
}
