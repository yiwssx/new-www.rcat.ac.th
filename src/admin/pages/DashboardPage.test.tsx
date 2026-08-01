import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminContentListItem, AdminDashboardSummary } from "../../features/admin-pagination";
import type { User } from "../../types";
import DashboardPage from "./DashboardPage";

const paginationMock = vi.hoisted(() => ({
  getAdminDashboardSummary: vi.fn(),
  publishAllPendingAdminContent: vi.fn()
}));

const swalInstance = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn()
}));

vi.mock("sweetalert2", () => ({ default: { mixin: vi.fn(() => swalInstance) } }));
vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

vi.mock("../../features/admin-pagination/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination/api")>()),
  getAdminDashboardSummary: paginationMock.getAdminDashboardSummary,
  publishAllPendingAdminContent: paginationMock.publishAllPendingAdminContent
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidatePublicCmsData: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => {
    const user: User = {
      id: "cloudflare-editor",
      name: "Cloudflare editor",
      email: "editor@example.invalid",
      role: "editor"
    };
    const session = { user, capabilities: ["content.publish"] };
    return { session, capabilities: ["content.publish"], login: vi.fn(), logout: vi.fn() };
  }
}));

function contentItem(id: string, title: string): AdminContentListItem {
  return {
    id,
    title,
    slug: id,
    type: "news",
    status: "review",
    owner: "editor@example.invalid",
    summary: "",
    category: "news",
    template: "standard",
    canonicalUrl: "",
    featured: false,
    featuredMediaId: "",
    viewCount: 0,
    lastViewedAt: "",
    updatedAt: "2026-07-13T00:00:00.000Z",
    publishAt: "",
    revision: 0
  };
}

function dashboardSummary(
  publishableCount: number,
  events: AdminDashboardSummary["events"] = []
): AdminDashboardSummary {
  const content = publishableCount
    ? [contentItem("review-one", "รายการพร้อมเผยแพร่"), contentItem("scheduled-due", "รายการถึงกำหนด")]
    : [];

  return {
    counts: { content: { total: 99, published: 1, draft: 96, review: 1, scheduled: 1 } },
    publishableCount,
    metrics: [],
    content,
    recentContent: [],
    documents: [],
    recentDocuments: [],
    events,
    recentEvents: [],
    generatedAt: "2026-07-13T00:00:00.000Z"
  };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  paginationMock.getAdminDashboardSummary.mockReset();
  paginationMock.getAdminDashboardSummary.mockResolvedValue(dashboardSummary(2));
  paginationMock.publishAllPendingAdminContent.mockReset();
  paginationMock.publishAllPendingAdminContent.mockResolvedValue({ publishedCount: 2 });
  swalInstance.fire.mockReset();
  swalInstance.fire.mockResolvedValue({ isConfirmed: false });
  swalInstance.close.mockReset();
  swalInstance.showLoading.mockReset();
});

describe("DashboardPage publish queue", () => {
  it("confirms with the explicit publishable count instead of total non-published content", async () => {
    renderDashboard();

    expect(await screen.findByText("รายการพร้อมเผยแพร่")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "เผยแพร่คิว" }));

    await waitFor(() =>
      expect(swalInstance.fire).toHaveBeenCalledWith(expect.objectContaining({ text: "เผยแพร่เนื้อหา 2 รายการตอนนี้" }))
    );
    expect(paginationMock.publishAllPendingAdminContent).not.toHaveBeenCalled();
  });

  it("shows an accurate empty state when no content is currently publishable", async () => {
    paginationMock.getAdminDashboardSummary.mockResolvedValue(dashboardSummary(0));
    renderDashboard();

    expect(await screen.findByText("ไม่มีรายการรอตรวจสอบหรือรายการตั้งเวลาที่ถึงกำหนดเผยแพร่")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "เผยแพร่คิว" }));

    await waitFor(() =>
      expect(swalInstance.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "ไม่มีรายการให้เผยแพร่",
          text: "ไม่มีรายการรอตรวจสอบหรือรายการตั้งเวลาที่ถึงกำหนดเผยแพร่"
        })
      )
    );
    expect(paginationMock.publishAllPendingAdminContent).not.toHaveBeenCalled();
  });

  it("keeps the event badge and text on the same Bangkok calendar day", async () => {
    paginationMock.getAdminDashboardSummary.mockResolvedValue(
      dashboardSummary(0, [
        {
          id: "boundary-event",
          title: "กิจกรรมข้ามเขตเวลา",
          audience: "นักเรียน",
          date: "2026-07-31T17:30:00.000Z",
          status: "confirmed"
        }
      ])
    );
    renderDashboard();

    expect(await screen.findByText("กิจกรรมข้ามเขตเวลา")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("นักเรียน | 1 สิงหาคม 2569 00:30")).toBeInTheDocument();
  });
});
