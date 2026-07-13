import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMenuListItem, AdminMenuOrderItem } from "../../features/admin-pagination";
import type { Session, User } from "../../types";
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
    const session: Session = { user, token: "test-session-token", expiresAt: "2026-12-31T00:00:00.000Z" };
    return { session, login: vi.fn(), logout: vi.fn() };
  }
}));

const menuItem: AdminMenuListItem = {
  id: "menu-news",
  label: "ข่าวสาร",
  href: "/news",
  enabled: true,
  parentId: null,
  order: 1,
  updatedAt: "2026-07-12T00:00:00.000Z",
  revision: 2
};

const secondMenuItem: AdminMenuListItem = {
  ...menuItem,
  id: "menu-about",
  label: "เกี่ยวกับเรา",
  href: "/about",
  order: 2,
  revision: 4
};

function menuPageResponse(
  items: AdminMenuListItem[],
  pagination: Partial<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  }> = {}
) {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 25;
  const totalItems = pagination.totalItems ?? items.length;
  const totalPages = pagination.totalPages ?? Math.ceil(totalItems / pageSize);
  return {
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: pagination.hasPreviousPage ?? page > 1,
      hasNextPage: pagination.hasNextPage ?? page < totalPages
    },
    generatedAt: "2026-07-12T00:00:00.000Z"
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
  window.history.replaceState({}, "", "/admin/menu");
  authMock.role = "admin";
  paginationMock.getAdminMenuList.mockReset();
  paginationMock.getAdminMenuList.mockResolvedValue(menuPageResponse([menuItem]));
  paginationMock.getAdminMenuOrder.mockReset();
  paginationMock.getAdminMenuOrder.mockResolvedValue([
    { id: menuItem.id, label: menuItem.label, order: 1, enabled: true, parentId: null, revision: 2 },
    { id: secondMenuItem.id, label: secondMenuItem.label, order: 2, enabled: true, parentId: null, revision: 4 }
  ] satisfies AdminMenuOrderItem[]);
  paginationMock.saveAdminMenuItem.mockReset();
  paginationMock.saveAdminMenuItem.mockResolvedValue(menuItem);
  paginationMock.deleteAdminMenuItem.mockReset();
  paginationMock.deleteAdminMenuItem.mockResolvedValue({ id: menuItem.id, deleted: true });
  paginationMock.saveAdminMenuOrder.mockReset();
  paginationMock.saveAdminMenuOrder.mockResolvedValue([]);
  publicInvalidationMock.invalidatePublicCmsData.mockReset();
  publicInvalidationMock.invalidatePublicCmsData.mockResolvedValue(undefined);
  swalInstance.fire.mockReset();
  swalInstance.fire.mockResolvedValue({ isConfirmed: true });
  swalInstance.close.mockReset();
  swalInstance.close.mockResolvedValue(undefined);
  swalInstance.showLoading.mockReset();
});

describe("MenuPage server pagination", () => {
  it("renders one server page and sends page/filter state from the URL", async () => {
    window.history.replaceState({}, "", "/admin/menu?page=2&enabled=false");
    paginationMock.getAdminMenuList.mockResolvedValue(
      menuPageResponse([{ ...menuItem, enabled: false }], { page: 2, totalItems: 26, totalPages: 2 })
    );
    renderMenuPage();

    expect(await screen.findByText(menuItem.label)).toBeInTheDocument();
    expect(screen.getByText("แสดง 26–26 จากทั้งหมด 26 รายการ")).toBeInTheDocument();
    await waitFor(() =>
      expect(paginationMock.getAdminMenuList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 25, enabled: false, sortBy: "order", sortDirection: "asc" })
      )
    );
  });

  it("resets page one for debounced search and server visibility filtering", async () => {
    window.history.replaceState({}, "", "/admin/menu?page=2");
    renderMenuPage();
    await screen.findByText(menuItem.label);

    fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาเมนู" }), { target: { value: "ข่าว" } });

    await waitFor(
      () =>
        expect(paginationMock.getAdminMenuList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, q: "ข่าว" })),
      { timeout: 1_500 }
    );
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "การแสดงผล" }));
    fireEvent.click(screen.getByRole("option", { name: "ซ่อน" }));

    await waitFor(() =>
      expect(paginationMock.getAdminMenuList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, enabled: false }))
    );
  });

  it("uses flat item CRUD and falls back after deleting the final item on page two", async () => {
    window.history.replaceState({}, "", "/admin/menu?page=2");
    paginationMock.getAdminMenuList.mockImplementation(async (request: { page?: number } = {}) =>
      request.page === 2
        ? menuPageResponse([menuItem], { page: 2, totalItems: 26, totalPages: 2 })
        : menuPageResponse([menuItem], { page: 1, totalItems: 25, totalPages: 1 })
    );
    renderMenuPage();
    await screen.findByText(menuItem.label);

    fireEvent.click(screen.getByRole("button", { name: "ลบ" }));

    await waitFor(() =>
      expect(paginationMock.deleteAdminMenuItem).toHaveBeenCalledWith(
        { id: menuItem.id, revision: 2 },
        expect.any(Object)
      )
    );
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("page")).toBeNull());

    paginationMock.getAdminMenuList.mockImplementation(async (request) =>
      request.pageSize === 1
        ? menuPageResponse([{ ...menuItem, order: 26 }], { totalItems: 26, totalPages: 2 })
        : menuPageResponse([menuItem], { page: 1, totalItems: 25, totalPages: 1 })
    );
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มเมนูหลัก" }));
    await screen.findByRole("textbox", { name: "ชื่อเมนู" });
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อเมนู" }), { target: { value: "รับสมัคร" } });
    fireEvent.change(screen.getByRole("textbox", { name: "เส้นทางหรือ URL" }), { target: { value: "/admission" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกรายการ" }));

    await waitFor(() =>
      expect(paginationMock.saveAdminMenuItem).toHaveBeenCalledWith(
        expect.objectContaining({ label: "รับสมัคร", href: "/content/admission", parentId: null, order: 27 }),
        expect.any(Object)
      )
    );
  });

  it("keeps read-only roles able to view pagination without mutation controls", async () => {
    authMock.role = "viewer";
    renderMenuPage();

    expect(await screen.findByText(menuItem.label)).toBeInTheDocument();
    expect(screen.getByText(/สามารถดูข้อมูลเพื่อตรวจสอบก่อนเผยแพร่ได้/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มเมนูหลัก" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "จัดลำดับ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบ" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "การแบ่งหน้ารายการ" })).toBeInTheDocument();
  });
});

describe("MenuPage compact ordering", () => {
  it("does not load global order until opened and saves sibling revisions", async () => {
    renderMenuPage();
    await screen.findByText(menuItem.label);
    expect(paginationMock.getAdminMenuOrder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "จัดลำดับ" }));

    expect(await screen.findByText(secondMenuItem.label)).toBeInTheDocument();
    await waitFor(() => expect(paginationMock.getAdminMenuOrder).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getAllByRole("button", { name: "ขึ้น" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลำดับ" }));

    await waitFor(() =>
      expect(paginationMock.saveAdminMenuOrder).toHaveBeenCalledWith(
        expect.arrayContaining([
          { id: secondMenuItem.id, label: secondMenuItem.label, order: 1, enabled: true, parentId: null, revision: 4 },
          { id: menuItem.id, label: menuItem.label, order: 2, enabled: true, parentId: null, revision: 2 }
        ]),
        expect.any(Object)
      )
    );
    expect(publicInvalidationMock.invalidatePublicCmsData).toHaveBeenCalled();
  });
});
