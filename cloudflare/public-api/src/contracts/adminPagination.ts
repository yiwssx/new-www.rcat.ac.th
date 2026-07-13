export const ADMIN_DEFAULT_PAGE_SIZE = 25;
export const ADMIN_MEDIA_DEFAULT_PAGE_SIZE = 24;
export const ADMIN_MAX_PAGE_SIZE = 100;

export interface AdminPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AdminPaginatedResponse<T> {
  items: T[];
  pagination: AdminPagination;
  generatedAt: string;
}

export interface AdminPaginationRequest {
  page: number;
  pageSize: number;
}

function positiveInteger(value: string | null, fallback: number) {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

export function parseAdminPagination(
  searchParams: URLSearchParams,
  defaultPageSize = ADMIN_DEFAULT_PAGE_SIZE
): AdminPaginationRequest {
  const normalizedDefault = Math.min(ADMIN_MAX_PAGE_SIZE, Math.max(1, Math.floor(defaultPageSize)));
  const page = positiveInteger(searchParams.get("page"), 1);
  const requestedPageSize = positiveInteger(searchParams.get("pageSize"), normalizedDefault);

  return {
    page,
    pageSize: Math.min(ADMIN_MAX_PAGE_SIZE, requestedPageSize)
  };
}

export function createAdminPagination(requested: AdminPaginationRequest, totalItems: number): AdminPagination {
  const safeTotalItems = Math.max(0, Math.floor(totalItems));
  const totalPages = safeTotalItems === 0 ? 0 : Math.ceil(safeTotalItems / requested.pageSize);
  const page = totalPages === 0 ? 1 : Math.min(requested.page, totalPages);

  return {
    page,
    pageSize: requested.pageSize,
    totalItems: safeTotalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages
  };
}
