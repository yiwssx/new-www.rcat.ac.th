import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminListUrlSearch, readAdminListUrlState, useAdminListUrlState, useDebouncedValue } from "./urlState";

const options = {
  defaultPageSize: 25,
  pageSizeOptions: [25, 50, 100] as const,
  defaultSortBy: "updatedAt",
  defaultSortDirection: "desc" as const,
  filterDefaults: { status: "all", type: "all" }
};

describe("admin list URL state", () => {
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, "", "/");
  });

  it("normalizes invalid values and reads filters and sorting", () => {
    expect(
      readAdminListUrlState("?page=-4&pageSize=26&q=%20ita%20&status=published&sortDirection=sideways", options)
    ).toEqual({
      page: 1,
      pageSize: 25,
      q: "ita",
      sortBy: "updatedAt",
      sortDirection: "desc",
      filters: { status: "published", type: "all" }
    });
  });

  it("resets page to one when search, filters, sort, or page size changes", () => {
    const nextSearch = createAdminListUrlSearch(
      "?page=8&pageSize=50&q=old&status=published&unrelated=kept",
      { q: "new", filters: { status: "draft" } },
      options
    );
    const params = new URLSearchParams(nextSearch);

    expect(params.get("page")).toBeNull();
    expect(params.get("pageSize")).toBe("50");
    expect(params.get("q")).toBe("new");
    expect(params.get("status")).toBe("draft");
    expect(params.get("unrelated")).toBe("kept");
  });

  it("pushes page changes into browser history and preserves the rest of the query", () => {
    window.history.replaceState(null, "", "/admin/content?q=ita&status=published");
    const { result } = renderHook(() => useAdminListUrlState(options));

    act(() => result.current.setPage(4));

    expect(window.location.search).toContain("page=4");
    expect(window.location.search).toContain("q=ita");
    expect(result.current.page).toBe(4);
  });

  it("keeps setters stable when callers pass an equivalent inline options object", () => {
    const { result, rerender } = renderHook(() =>
      useAdminListUrlState({
        defaultPageSize: 25,
        pageSizeOptions: [25, 50, 100],
        filterDefaults: { status: "all" }
      })
    );
    const firstSetSearch = result.current.setSearch;

    rerender();

    expect(result.current.setSearch).toBe(firstSetSearch);
  });

  it("debounces search values for approximately 300ms", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "old" }
    });

    rerender({ value: "new" });
    expect(result.current).toBe("old");

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("old");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("new");
  });
});
