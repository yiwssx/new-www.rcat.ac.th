import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

interface UsePublicPaginationOptions {
  pageSize: number;
  queryParam?: string;
  resetKeys?: readonly unknown[];
  scrollTargetId?: string;
}

const PUBLIC_PAGINATION_LOCATION_EVENT = "rcat:public-pagination-location";

function normalizePageSize(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function getCurrentSearch() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.search;
}

function subscribeToSearchChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(PUBLIC_PAGINATION_LOCATION_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(PUBLIC_PAGINATION_LOCATION_EVENT, onStoreChange);
  };
}

function readPageFromSearch(search: string, queryParam: string) {
  const rawValue = new URLSearchParams(search).get(queryParam);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

function createResetSignature(resetKeys: readonly unknown[]) {
  return resetKeys.map((value) => String(value ?? "")).join("\u001f");
}

export function usePublicPagination<T>(
  items: readonly T[],
  { pageSize, queryParam = "page", resetKeys = [], scrollTargetId }: UsePublicPaginationOptions
) {
  const normalizedPageSize = normalizePageSize(pageSize);
  const search = useSyncExternalStore(subscribeToSearchChanges, getCurrentSearch, () => "");
  const totalItems = items.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const requestedPage = readPageFromSearch(search, queryParam);
  const page = Math.min(requestedPage, pageCount);
  const startIndex = (page - 1) * normalizedPageSize;
  const endIndex = Math.min(startIndex + normalizedPageSize, totalItems);
  const resetSignature = createResetSignature(resetKeys);
  const previousResetSignatureRef = useRef(resetSignature);

  const updatePage = useCallback(
    (nextPage: number, options: { replace?: boolean; scroll?: boolean } = {}) => {
      if (typeof window === "undefined") {
        return;
      }

      const clampedPage = Math.min(Math.max(1, Math.floor(nextPage)), pageCount);
      const url = new URL(window.location.href);

      if (clampedPage <= 1) {
        url.searchParams.delete(queryParam);
      } else {
        url.searchParams.set(queryParam, String(clampedPage));
      }

      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method]({}, "", nextUrl);
      window.dispatchEvent(new Event(PUBLIC_PAGINATION_LOCATION_EVENT));

      if (options.scroll && scrollTargetId) {
        window.requestAnimationFrame(() => {
          const target = document.getElementById(scrollTargetId);

          if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }
    },
    [pageCount, queryParam, scrollTargetId]
  );

  useEffect(() => {
    const previousSignature = previousResetSignatureRef.current;

    if (previousSignature !== resetSignature) {
      previousResetSignatureRef.current = resetSignature;

      if (readPageFromSearch(getCurrentSearch(), queryParam) !== 1) {
        updatePage(1, { replace: true });
      }
    }
  }, [queryParam, resetSignature, updatePage]);

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
