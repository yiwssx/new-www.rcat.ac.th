import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicDocumentsPage from "./PublicDocumentsPage";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>
}));

const documentListMock = vi.hoisted(() => ({
  data: {
    generatedAt: "2026-10-04T00:00:00.000Z",
    items: [
      {
        id: "plan-1",
        title: "แผนปฏิบัติการประจำปี",
        description: "",
        category: "แผนงาน",
        fileUrl: "https://example.edu/annual-plan.pdf",
        fileName: "annual-plan.pdf",
        mediaId: "",
        publishedAt: "2026-10-01T00:00:00.000Z",
        order: 1,
        pinned: false,
        updatedAt: "2026-10-01T00:00:00.000Z"
      },
      {
        id: "form-1",
        title: "แบบฟอร์มนักเรียน",
        description: "",
        category: "แบบฟอร์ม",
        fileUrl: "https://example.edu/student-form.pdf",
        fileName: "student-form.pdf",
        mediaId: "",
        publishedAt: "2026-10-02T00:00:00.000Z",
        order: 2,
        pinned: false,
        updatedAt: "2026-10-02T00:00:00.000Z"
      }
    ]
  }
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => routerMocks.navigate,
  useRouterState: (options?: { select?: (state: { location: { search: Record<string, unknown> } }) => unknown }) => {
    const state = { location: { search: routerMocks.search } };
    return options?.select ? options.select(state) : state;
  }
}));

vi.mock("../hooks/usePublicDocumentList", () => ({
  usePublicDocumentList: () => ({
    data: documentListMock.data,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn()
  })
}));

vi.mock("../components/PublicSiteShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("../components/PublicLoadingState", () => ({
  default: () => null,
  PublicBackgroundProgress: () => null
}));

vi.mock("../components/PublicErrorState", () => ({
  default: () => null
}));

vi.mock("../components/PublicPagination", () => ({
  PublicPagination: () => null
}));

vi.mock("../../features/public-documents", () => ({
  DocumentListCard: ({ items }: { items: Array<{ id: string; title: string }> }) => (
    <div>
      {items.map((item) => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  )
}));

function getLatestNavigation() {
  const calls = routerMocks.navigate.mock.calls;
  return calls[calls.length - 1]?.[0] as {
    search: (previous: Record<string, unknown>) => Record<string, unknown>;
    replace?: boolean;
    resetScroll?: boolean;
  };
}

describe("PublicDocumentsPage query filters", () => {
  beforeEach(() => {
    routerMocks.navigate.mockReset();
    routerMocks.search = {};
  });

  it("applies q and category from the URL on first render", () => {
    routerMocks.search = { q: "student-form", category: "แบบฟอร์ม" };

    render(<PublicDocumentsPage />);

    expect(screen.getByRole("searchbox", { name: "ค้นหาเอกสารเผยแพร่" })).toHaveValue("student-form");
    expect(screen.getByText("แบบฟอร์มนักเรียน")).toBeInTheDocument();
    expect(screen.queryByText("แผนปฏิบัติการประจำปี")).not.toBeInTheDocument();
  });

  it("writes search changes to q and removes page while preserving other search state", () => {
    routerMocks.search = { page: 2, category: "คู่มือ" };

    render(<PublicDocumentsPage />);
    routerMocks.navigate.mockClear();

    fireEvent.change(screen.getByRole("searchbox", { name: "ค้นหาเอกสารเผยแพร่" }), {
      target: { value: "student" }
    });

    const navigation = getLatestNavigation();

    expect(navigation.search({ page: 2, category: "คู่มือ" })).toEqual({
      category: "คู่มือ",
      q: "student"
    });
    expect(navigation.replace).toBe(true);
    expect(navigation.resetScroll).toBe(false);
  });

  it("clears q, category, and page together", () => {
    routerMocks.search = { q: "student", category: "แบบฟอร์ม", page: 2 };

    render(<PublicDocumentsPage />);
    routerMocks.navigate.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));

    const navigation = getLatestNavigation();

    expect(navigation.search({ q: "student", category: "แบบฟอร์ม", page: 2 })).toEqual({});
  });
});
