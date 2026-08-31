import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { normalizePublicPageSearchValue } from "../routing/searchParams";

export type PublicPaginationQueryParam = "page" | "announcementsPage" | "pagesPage";

interface ServerPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface UsePublicPaginationOptions {
  pageSize: number;
  queryParam?: PublicPaginationQueryParam;
  resetKeys?: readonly unknown[];
  scrollTargetId?: string;
  serverPagination?: ServerPagination;
  serverPaginationPending?: boolean;
}

function normalizePageSize(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function createResetSignature(resetKeys: readonly unknown[]) {
  return resetKeys.map((value) => String(value ?? "")).join("\u001f");
}

export function usePublicPagination<T>(
  items: T[],
  {
    pageSize,
    queryParam = "page",
    resetKeys = [],
    scrollTargetId,
    serverPagination,
    serverPaginationPending = false
  }: UsePublicPaginationOptions
) {
  const navigate = useNavigate();
  const routeSearch = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const requestedPage = normalizePublicPageSearchValue(routeSearch[queryParam]) ?? 1;
  const fallbackPageSize = normalizePageSize(pageSize);
  const normalizedPageSize = serverPagination ? normalizePageSize(serverPagination.pageSize) : fallbackPageSize;
  const clientTotalItems = items.length;
  const totalItems = serverPagination ? Math.max(0, Math.floor(serverPagination.totalItems)) : clientTotalItems;
  const clientPageCount = Math.max(1, Math.ceil(clientTotalItems / normalizedPageSize));
  const resolvedPageCount = serverPagination ? Math.max(1, Math.floor(serverPagination.totalPages)) : clientPageCount;
  const pageCount = serverPaginationPending ? Math.max(requestedPage, resolvedPageCount) : resolvedPageCount;
  const serverPage = serverPagination ? Math.max(1, Math.floor(serverPagination.page)) : requestedPage;
  const page = serverPaginationPending
    ? requestedPage
    : Math.min(serverPagination ? serverPage : requestedPage, pageCount);
  const startIndex = (page - 1) * normalizedPageSize;
  const endIndex = Math.min(startIndex + normalizedPageSize, clientTotalItems);
  const resetSignature = createResetSignature(resetKeys);
  const previousResetSignatureRef = useRef(resetSignature);

  const updatePage = useCallback(
    (nextPage: number, options: { replace?: boolean; scroll?: boolean } = {}) => {
      const clampedPage = Math.min(Math.max(1, Math.floor(nextPage)), pageCount);

      void navigate({
        to: ".",
        search: (previous) => {
          const nextSearch = { ...previous } as typeof previous & Record<string, unknown>;

          if (clampedPage <= 1) {
            delete nextSearch[queryParam];
          } else {
            nextSearch[queryParam] = clampedPage;
          }

          return nextSearch;
        },
        replace: options.replace,
        resetScroll: false
      });

      if (options.scroll && scrollTargetId && typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          const target = document.getElementById(scrollTargetId);

          if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }
    },
    [navigate, pageCount, queryParam, scrollTargetId]
  );

  useEffect(() => {
    const previousSignature = previousResetSignatureRef.current;

    if (previousSignature !== resetSignature) {
      previousResetSignatureRef.current = resetSignature;

      if (requestedPage !== 1) {
        updatePage(1, { replace: true });
      }
    }
  }, [requestedPage, resetSignature, updatePage]);

  useEffect(() => {
    if (!serverPaginationPending && requestedPage !== page) {
      updatePage(page, { replace: true });
    }
  }, [page, requestedPage, serverPaginationPending, updatePage]);

  const paginatedItems = useMemo(
    () => (serverPagination || serverPaginationPending ? items : items.slice(startIndex, endIndex)),
    [endIndex, items, serverPagination, serverPaginationPending, startIndex]
  );

  return {
    page,
    pageCount,
    pageSize: normalizedPageSize,
    paginatedItems,
    setPage: updatePage,
    totalItems
  };
}
