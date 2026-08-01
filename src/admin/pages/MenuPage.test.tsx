import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMenuOrderItem } from "../../features/admin-pagination";
import type { PublicMenuItem } from "../../features/cms-navigation/types";
import type { User } from "../../types";
import MenuPage from "./MenuPage";

const authMock = vi.hoisted(() => ({ role: "admin" as User["role"] }));
const paginationMock = vi.hoisted(() => ({
  getAdminMenuOrder: vi.fn(),
  saveAdminMenuItem: vi.fn(),
  deleteAdminMenuItem: vi.fn(),
  saveAdminMenuOrder: vi.fn()
}));
const adminWriteMock = vi.hoisted(() => ({ getPublicMenuItemsFromCloudflare: vi.fn() }));
const publicInvalidationMock = vi.hoisted(() => ({ invalidatePublicCmsData: vi.fn() }));
const swalInstance = vi.hoisted(() => ({ fire: vi.fn(), close: vi.fn(), showLoading: vi.fn() }));

vi.mock("sweetalert2", () => ({ default: { mixin: vi.fn(() => swalInstance) } }));
vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

vi.mock("../../features/admin-write/cloudflareApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-write/cloudflareApi")>()),
  getPublicMenuItemsFromCloudflare: adminWriteMock.getPublicMenuItemsFromCloudflare
}));

vi.mock("../../features/admin-pagination/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination/api")>()),
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

const menuTree: PublicMenuItem[] = [
  {
    id: "menu-about-internal-id",
    label: "เกี่ยวกับวิทยาลัย",
    href: "/about",
    enabled: true,
    children: [
      {
        id: "menu-history-internal-id",
        label: "ประวัติวิทยาลัย",
        href: "/history",
        enabled: true
      }
    ]
  },
  {
    id: "menu-news-internal-id",
    label: "ข่าวสาร",
    href: "/news",
    enabled: true
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
  adminWriteMock.getPublicMenuItemsFromCloudflare.mockReset();
  adminWriteMock.getPublicMenuItemsFromCloudflare.mockResolvedValue(menuTree);
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

describe("MenuPage hierarchy UX", () => {
  it("renders submenu beneath its parent using readable labels and never exposes internal menu ids", async () => {
    renderMenuPage();

    expect(await screen.findByText("เกี่ยวกับวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText("ประวัติวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText("ภายใต้ เกี่ยวกับวิทยาลัย")).toBeInTheDocument();
    expect(screen.queryByText("menu-about-internal-id")).not.toBeInTheDocument();
    expect(screen.queryByText("menu-history-internal-id")).not.toBeInTheDocument();
    expect(screen.queryByText(/Menu ID แม่/)).not.toBeInTheDocument();
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

  it("keeps read-only users on the readable tree without mutation controls", async () => {
    authMock.role = "viewer";
    renderMenuPage();

    expect(await screen.findByText("เกี่ยวกับวิทยาลัย")).toBeInTheDocument();
    expect(screen.getByText(/มีสิทธิ์อ่านข้อมูลเท่านั้น/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มเมนูหลัก" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "จัดลำดับ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบ" })).not.toBeInTheDocument();
  });
});
