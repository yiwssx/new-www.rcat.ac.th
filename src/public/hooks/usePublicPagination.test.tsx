import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublicPagination } from "./usePublicPagination";

type RouterState = {
  location: {
    search: Record<string, unknown>;
  };
};

type RouterOptions = {
  select?: (state: RouterState) => unknown;
};

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routerMocks.navigate,
  useRouterState: (options?: RouterOptions) => {
    const state: RouterState = {
      location: {
        search: routerMocks.search
      }
    };

    return options?.select ? options.select(state) : state;
  }
}));

beforeEach(() => {
  routerMocks.navigate.mockReset();
  routerMocks.search = {};
});

describe("usePublicPagination", () => {
  it("preserves a requested server page while the next pagination response is pending", () => {
    routerMocks.search = { page: 200 };

    const { result } = renderHook(() =>
      usePublicPagination([], { pageSize: 12, serverPaginationPending: true })
    );

    expect(result.current.page).toBe(200);
    expect(result.current.pageCount).toBe(200);
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("uses the resolved server page without rewriting a valid requested page", () => {
    routerMocks.search = { page: 200 };

    const serverPagination = {
      page: 200,
      pageSize: 12,
      totalItems: 2500,
      totalPages: 209
    };
    const { result } = renderHook(() => usePublicPagination([], { pageSize: 12, serverPagination }));

    expect(result.current.page).toBe(200);
    expect(result.current.pageCount).toBe(209);
    expect(result.current.totalItems).toBe(2500);
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("canonicalizes an out-of-range page only after the server pagination response resolves", async () => {
    routerMocks.search = { page: 220 };

    const serverPagination = {
      page: 209,
      pageSize: 12,
      totalItems: 2500,
      totalPages: 209
    };
    const { result } = renderHook(() => usePublicPagination([], { pageSize: 12, serverPagination }));

    expect(result.current.page).toBe(209);

    await waitFor(() => expect(routerMocks.navigate).toHaveBeenCalledTimes(1));

    const navigation = routerMocks.navigate.mock.calls[0]?.[0] as {
      replace?: boolean;
      search: (previous: Record<string, unknown>) => Record<string, unknown>;
    };

    expect(navigation.replace).toBe(true);
    expect(navigation.search({ page: 220 })).toEqual({ page: 209 });
  });

  it("keeps the existing client-side out-of-range page normalization", async () => {
    routerMocks.search = { page: 2 };

    const items = Array.from({ length: 12 }, (_, index) => index);
    const { result } = renderHook(() => usePublicPagination(items, { pageSize: 12 }));

    expect(result.current.page).toBe(1);

    await waitFor(() => expect(routerMocks.navigate).toHaveBeenCalledTimes(1));

    const navigation = routerMocks.navigate.mock.calls[0]?.[0] as {
      search: (previous: Record<string, unknown>) => Record<string, unknown>;
    };

    expect(navigation.search({ page: 2 })).toEqual({});
  });
});
