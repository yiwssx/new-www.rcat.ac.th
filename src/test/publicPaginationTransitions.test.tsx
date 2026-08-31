import type { ReactNode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicAnnouncementsPage from "../public/pages/PublicAnnouncementsPage";
import PublicBlogPage from "../public/pages/PublicBlogPage";
import type { PublicContentListSnapshot } from "../types";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>
}));

const queryState = vi.hoisted(() => ({
  data: undefined as PublicContentListSnapshot | undefined,
  isLoading: true,
  isFetching: true,
  isError: false,
  refetch: vi.fn()
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => routerMocks.navigate,
  useRouterState: (options?: { select?: (state: { location: { search: Record<string, unknown> } }) => unknown }) => {
    const state = { location: { search: routerMocks.search } };
    return options?.select ? options.select(state) : state;
  }
}));

vi.mock("../public/hooks/usePublicContentList", () => ({
  usePublicContentList: () => queryState
}));

vi.mock("../public/components/PublicSiteShell", () => ({
  default: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}));

vi.mock("../public/components/PublicLoadingState", () => ({
  default: () => <div data-testid="public-loading-state" />,
  PublicBackgroundProgress: () => null
}));

beforeEach(() => {
  routerMocks.navigate.mockReset();
  routerMocks.search = {};
  queryState.data = undefined;
  queryState.isLoading = true;
  queryState.isFetching = true;
  queryState.isError = false;
  queryState.refetch.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("public pagination transitions", () => {
  it("preserves a deep Blog page while the next server page is unresolved", async () => {
    routerMocks.search = { page: 200 };

    render(<PublicBlogPage />);
    await act(async () => Promise.resolve());

    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("preserves the announcement page while a public-pages request is unresolved", async () => {
    routerMocks.search = { announcementsPage: 5, pagesPage: 2 };

    render(<PublicAnnouncementsPage />);
    await act(async () => Promise.resolve());

    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });
});
