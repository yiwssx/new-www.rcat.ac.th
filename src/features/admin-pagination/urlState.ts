import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AdminSortDirection } from "./types";
import { ADMIN_DEFAULT_PAGE_SIZE, ADMIN_MAX_PAGE_SIZE } from "./types";

export const ADMIN_LIST_LOCATION_EVENT = "rcat:admin-list-location";

export interface AdminListUrlState<FilterKey extends string = string> {
  page: number;
  pageSize: number;
  q: string;
  sortBy?: string;
  sortDirection?: AdminSortDirection;
  filters: Record<FilterKey, string>;
}

export interface AdminListUrlStateOptions<FilterKey extends string = string> {
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  defaultSortBy?: string;
  defaultSortDirection?: AdminSortDirection;
  filterDefaults?: Partial<Record<FilterKey, string>>;
}

export interface AdminListUrlStatePatch<FilterKey extends string = string> {
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: string | null;
  sortDirection?: AdminSortDirection | null;
  filters?: Partial<Record<FilterKey, string | null>>;
}

interface AdminListHistoryOptions {
  replace?: boolean;
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeAdminPage(value: unknown) {
  return normalizePositiveInteger(value, 1);
}

export function normalizeAdminPageSize(
  value: unknown,
  defaultPageSize = ADMIN_DEFAULT_PAGE_SIZE,
  pageSizeOptions?: readonly number[]
) {
  const safeDefault = Math.min(normalizePositiveInteger(defaultPageSize, ADMIN_DEFAULT_PAGE_SIZE), ADMIN_MAX_PAGE_SIZE);
  const normalized = Math.min(normalizePositiveInteger(value, safeDefault), ADMIN_MAX_PAGE_SIZE);

  if (pageSizeOptions?.length && !pageSizeOptions.includes(normalized)) {
    return safeDefault;
  }

  return normalized;
}

export function readAdminListUrlState<FilterKey extends string>(
  search: string,
  options: AdminListUrlStateOptions<FilterKey> = {}
): AdminListUrlState<FilterKey> {
  const params = new URLSearchParams(search);
  const defaultPageSize = options.defaultPageSize ?? ADMIN_DEFAULT_PAGE_SIZE;
  const rawSortDirection = params.get("sortDirection");
  const filters = {} as Record<FilterKey, string>;

  for (const [key, defaultValue = ""] of Object.entries(options.filterDefaults ?? {}) as Array<
    [FilterKey, string | undefined]
  >) {
    filters[key] = params.get(key) ?? defaultValue;
  }

  return {
    page: normalizeAdminPage(params.get("page")),
    pageSize: normalizeAdminPageSize(params.get("pageSize"), defaultPageSize, options.pageSizeOptions),
    q: params.get("q")?.trim() ?? "",
    sortBy: params.get("sortBy")?.trim() || options.defaultSortBy,
    sortDirection:
      rawSortDirection === "asc" || rawSortDirection === "desc" ? rawSortDirection : options.defaultSortDirection,
    filters
  };
}

function setOrDelete(params: URLSearchParams, key: string, value: string, defaultValue = "") {
  if (!value || value === defaultValue) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
}

export function createAdminListUrlSearch<FilterKey extends string>(
  currentSearch: string,
  patch: AdminListUrlStatePatch<FilterKey>,
  options: AdminListUrlStateOptions<FilterKey> = {}
) {
  const params = new URLSearchParams(currentSearch);
  const current = readAdminListUrlState(currentSearch, options);
  const defaultPageSize = options.defaultPageSize ?? ADMIN_DEFAULT_PAGE_SIZE;
  const changesListShape =
    patch.pageSize !== undefined ||
    patch.q !== undefined ||
    patch.sortBy !== undefined ||
    patch.sortDirection !== undefined ||
    patch.filters !== undefined;
  const nextPage = patch.page ?? (changesListShape ? 1 : current.page);
  const nextPageSize =
    patch.pageSize === undefined
      ? current.pageSize
      : normalizeAdminPageSize(patch.pageSize, defaultPageSize, options.pageSizeOptions);

  setOrDelete(params, "page", String(normalizeAdminPage(nextPage)), "1");
  setOrDelete(params, "pageSize", String(nextPageSize), String(defaultPageSize));

  if (patch.q !== undefined) {
    setOrDelete(params, "q", patch.q.trim());
  }

  if (patch.sortBy !== undefined) {
    setOrDelete(params, "sortBy", patch.sortBy?.trim() ?? "", options.defaultSortBy);
  }

  if (patch.sortDirection !== undefined) {
    setOrDelete(params, "sortDirection", patch.sortDirection ?? "", options.defaultSortDirection);
  }

  for (const [key, value] of Object.entries(patch.filters ?? {}) as Array<[FilterKey, string | null | undefined]>) {
    setOrDelete(params, key, value?.trim() ?? "", options.filterDefaults?.[key]);
  }

  const result = params.toString();
  return result ? `?${result}` : "";
}

function getCurrentSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function subscribeToLocationChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(ADMIN_LIST_LOCATION_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(ADMIN_LIST_LOCATION_EVENT, onStoreChange);
  };
}

export function useAdminListUrlState<FilterKey extends string = string>(
  options: AdminListUrlStateOptions<FilterKey> = {}
) {
  const serializedOptions = JSON.stringify({
    defaultPageSize: options.defaultPageSize,
    pageSizeOptions: options.pageSizeOptions,
    defaultSortBy: options.defaultSortBy,
    defaultSortDirection: options.defaultSortDirection,
    filterDefaults: Object.fromEntries(
      Object.entries(options.filterDefaults ?? {}).sort(([left], [right]) => left.localeCompare(right))
    )
  });
  const stableOptions = useMemo(
    () => JSON.parse(serializedOptions) as AdminListUrlStateOptions<FilterKey>,
    [serializedOptions]
  );
  const search = useSyncExternalStore(subscribeToLocationChanges, getCurrentSearch, () => "");
  const state = useMemo(() => readAdminListUrlState(search, stableOptions), [search, stableOptions]);

  const setState = useCallback(
    (patch: AdminListUrlStatePatch<FilterKey>, historyOptions: AdminListHistoryOptions = {}) => {
      if (typeof window === "undefined") {
        return;
      }

      const nextSearch = createAdminListUrlSearch(window.location.search, patch, stableOptions);
      const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
      const method = historyOptions.replace ? "replaceState" : "pushState";
      window.history[method](window.history.state, "", nextUrl);
      window.dispatchEvent(new Event(ADMIN_LIST_LOCATION_EVENT));
    },
    [stableOptions]
  );

  const setPage = useCallback((page: number) => setState({ page }), [setState]);
  const setPageSize = useCallback((pageSize: number) => setState({ pageSize }), [setState]);
  const setSearch = useCallback(
    (q: string, historyOptions: AdminListHistoryOptions = { replace: true }) => setState({ q }, historyOptions),
    [setState]
  );
  const setFilter = useCallback(
    (key: FilterKey, value: string, historyOptions?: AdminListHistoryOptions) =>
      setState({ filters: { [key]: value } as Partial<Record<FilterKey, string>> }, historyOptions),
    [setState]
  );
  const setSort = useCallback(
    (sortBy: string, sortDirection: AdminSortDirection, historyOptions?: AdminListHistoryOptions) =>
      setState({ sortBy, sortDirection }, historyOptions),
    [setState]
  );

  return {
    ...state,
    setState,
    setPage,
    setPageSize,
    setSearch,
    setFilter,
    setSort
  };
}

export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), Math.max(0, delayMs));
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}
