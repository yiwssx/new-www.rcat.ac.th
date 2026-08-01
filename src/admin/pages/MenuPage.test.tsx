import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMenuListItem, AdminMenuOrderItem } from "../../features/admin-pagination";
import type { User } from "../../types";
import MenuPage from "./MenuPage";

const authMock = vi.hoisted(() => ({ role: "admin" as User["role"] }));
const paginationMock = vi.hoisted(() => ({
  getAdminMenuList: vi.fn(),
  getAdminMenuOrder: vi.fn(),
  saveAdminMenuItem: vi.fn(),
  deleteAdminMenuItem: vi.fn(),
  saveAdminMenuOrder: vi.fn()
}));
const publicInvalidationMock = vi.hoisted(() => ({ invalidatePublicCmsData: vi.fn() }));
const swalInstance = vi.hoisted(() => ({ fire: vi.fn(), close: vi.fn(), showLoading: vi.fn() }));

vi.mock("sweetalert2", () => ({ default: { mixin: vi.fn(() => swalInstance) } }));
vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

vi.mock("../../features/admin-pagination/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination/api")>()),
  getAdminMenuList: paginationMock.getAdminMenuList,
  getAdminMenuOrder: paginationMock.getAdminMenuOrder,
  saveAdminMenuItem: paginationMock.saveAdminMenuItem,
  deleteAdminMenuItem: paginationMock.deleteAdminMenuItem,
  saveAdminMenuOrder: paginationMock.saveAdminMenuOrder
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidatePublicCmsData: publicInvalidationMock.invalidatePublicCmsData
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => {
    const user: User = {
      id: `cloudflare-${authMock.role}`,
      name: `Cloudflare ${authMock.role}`,
      email: `${authMock.role}@example.invalid`,
      role: authMock.role
    };
    return {
      session: { user, capabilities: authMock.role === "admin" ? ["menu.manage"] : [] },
      capabilities: authMock.role === "admin" ? ["menu.manage"] : [],
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

const flatMenuItems: AdminMenuListItem[] = [
  {
    id: "menu-history-internal-id",
    label: "ประวัติวิทยาลัย",
    href: "/history",
    enabled: true,
    parentId: "menu-about-internal-id",
    order: 1,
    updatedAt: "2026-08-01T00:00:00.000Z",
    revision: 3
  },
  {
    id: "menu-about-internal-id",
    label: "เกี่ยวกับวิทยาลัย",
    href: "/about",
    enabled: true,
    parentId: null,
    order: 1,
    updatedAt: "2026-08-01T00:00:00.000Z",
    revision: 2
  },
  {
    id: "menu-news-internal-id",
    label: "ข่าวสาร",
    href: "/news",
    enabled: true,
    parentId: null,
    order: 2,
    updatedAt: "2026-08-01T00:00:00.000Z",
    revision: 4
  }
];

const orderItems: AdminMenuOrderItem[] = [
  {
    id: "menu-about-internal-id",
    label: "เกี่ยวกับวิทยาลัย",
    parentId: null,
    order: 1,
    enabled: true,
    revision: 2
  },
  {
    id: "menu-history-internal-id",
    label: "ประวัติวิทยาลัย",
    parentId: "menu-about-internal-id",
    order: 1,
    enabled: true,
    revision: 3
  },
  {
    id: "menu-news-internal-id",
    label: "ข่าวสาร",
    parentId: null,
    order: 2,
    enabled: true,
    revision: 4
  }
];

function menuPageResponse(items: AdminMenuListItem[]) {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 100,
      totalItems: items.length,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false
    },
    generatedAt: "2026-08-01T00:00:00.000Z"
  };
}

function renderMenuPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MenuPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  authMock.role = "admin";
  paginationMock.getAdminMenuList.mockReset();
  paginationMock.getAdminMenuList.mockResolvedValue(menuPageResponse(flatMenuItems));
  paginationMock.getAdminMenuOrder.mockReset();
  paginationMock.getAdminMenuOrder.mockResolvedValue(orderItems);
  paginationMock.saveAdminMenuItem.mockReset();
  paginationMock.saveAdminMenuItem.mockResolvedValue({});
  paginationMock.deleteAdminMenuItem.mockReset();
  paginationMock.deleteAdminMenuItem.mockResolvedValue({ id: "menu-news-internal-id", deleted: true });
  paginationMock.saveAdminMenuOrder.mockReset();
  paginationMock.saveAdminMenuOrder.mockResolvedValue(orderItems);
  publicInvalidationMock.invalidatePublicCmsData.mockReset();
  publicInvalidationMock.invalidatePublicCmsData.mockResolvedValue(undefined);
  swalInstance.fire.mockReset();
  swalInstance.fire.mockResolvedValue({ isConfirmed: true });
  swalInstance.close.mockReset();
  swalInstance.close.mockResolvedValue(undefined);
  swalInstance.showLoading.mockReset();
});

describe("MenuPage WordPress-style hierarchy UX", () => {
  it("reconstructs a submenu from flat production rows and renders it one level beneath its parent", async () => {
    renderMenuPage();

    const parentLabel = await screen.findByText("เกี่ยวกับวิทยาลัย");
    const childLabel = screen.getByText("ประวัติวิทยาลัย");

    const parentRow = parentLabel.closest("[data-menu-depth]");
    const childRow = childLabel.closest("[data-menu-depth]");

    expect(parentRow).toHaveAttribute("data-menu-depth", "0");
    expect(childRow).toHaveAttribute("data-menu-depth", "1");
    expect(screen.getByText("ภายใต้ เกี่ยวกับวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText("เมนูย่อย")).toBeInTheDocument();
    expect(screen.queryByText("menu-about-internal-id")).not.toBeInTheDocument();
    expect(screen.queryByText("menu-history-internal-id")).not.toBeInTheDocument();
  });

  it("loads the real flat Admin menu API instead of assuming /api/admin/menu is already a tree", async () => {
    renderMenuPage();
    await screen.findByText("เกี่ยวกับวิทยาลัย");

    expect(paginationMock.getAdminMenuList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 100,
      sortBy: "order",
      sortDirection: "asc"
    });
  });

  it("preserves a root permalink instead of rewriting it to /content/...", async () => {
    renderMenuPage();
    await screen.findByText("เกี่ยวกับวิทยาลัย");

    fireEvent.click(screen.getByRole("button", { name: "เพิ่มเมนูหลัก" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อเมนู" }), { target: { value: "รับสมัคร" } });
    fireEvent.change(screen.getByRole("textbox", { name: "เส้นทางหรือ URL" }), { target: { value: "/admission" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกรายการ" }));

    await waitFor(() =>
      expect(paginationMock.saveAdminMenuItem).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "รับสมัคร",
          href: "/admission",
          parentId: null,
          order: 3
        }),
        expect.any(Object)
      )
    );
  });

  it("creates a submenu from the parent action without asking the user to type an internal id", async () => {
    renderMenuPage();
    await screen.findByText("เกี่ยวกับวิทยาลัย");

    fireEvent.click(screen.getAllByRole("button", { name: "เพิ่มเมนูย่อย" })[0]);

    expect(screen.getByRole("heading", { name: "เพิ่มเมนูย่อย" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "เมนูแม่" })).toBeInTheDocument();
    expect(screen.getByText(/เลือกจากชื่อเมนู/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Menu ID/i })).not.toBeInTheDocument();
  });

  it("keeps read-only users on the readable hierarchy without mutation controls", async () => {
    authMock.role = "viewer";
    renderMenuPage();

    expect(await screen.findByText("เกี่ยวกับวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText("ประวัติวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText(/มีสิทธิ์อ่านข้อมูลเท่านั้น/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มเมนูหลัก" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "จัดลำดับ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบ" })).not.toBeInTheDocument();
  });
});
