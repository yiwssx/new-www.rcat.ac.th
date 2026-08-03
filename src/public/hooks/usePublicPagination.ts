import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { normalizePublicPageSearchValue } from "../routing/searchParams";

export type PublicPaginationQueryParam = "page" | "announcementsPage" | "pagesPage";

interface UsePublicPaginationOptions {
  pageSize: number;
  queryParam?: PublicPaginationQueryParam;
  resetKeys?: readonly unknown[];
  scrollTargetId?: string;
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
  items: readonly T[],
  { pageSize, queryParam = "page", resetKeys = [], scrollTargetId }: UsePublicPaginationOptions
) {
  const navigate = useNavigate();
  const routeSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const normalizedPageSize = normalizePageSize(pageSize);
  const totalItems = items.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const requestedPage = normalizePublicPageSearchValue(routeSearch[queryParam]) ?? 1;
  const page = Math.min(requestedPage, pageCount);
  const startIndex = (page - 1) * normalizedPageSize;
  const endIndex = Math.min(startIndex + normalizedPageSize, totalItems);
  const resetSignature = createResetSignature(resetKeys);
  const previousResetSignatureRef = useRef(resetSignature);

  const updatePage = useCallback(
    (nextPage: number, options: { replace?: boolean; scroll?: boolean } = {}) => {
      const clampedPage = Math.min(Math.max(1, Math.floor(nextPage)), pageCount);

      void navigate({
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
    if (requestedPage !== page) {
      updatePage(page, { replace: true });
    }
  }, [page, requestedPage, updatePage]);

  const paginatedItems = useMemo(() => items.slice(startIndex, endIndex), [endIndex, items, startIndex]);

  return {
    page,
    pageCount,
    pageSize: normalizedPageSize,
    paginatedItems,
    setPage: updatePage,
    totalItems
  };
}
