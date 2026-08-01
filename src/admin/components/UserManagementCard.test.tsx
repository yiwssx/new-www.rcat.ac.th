import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUserProfile } from "../../features/admin-write/cloudflareApi";
import type { CmsCapability, CmsRole } from "../../features/cms-auth";
import UserManagementCard from "./UserManagementCard";

const authMock = vi.hoisted(() => ({
  capabilities: ["users.read-all", "users.update-any"] as CmsCapability[],
  role: "admin" as CmsRole
}));
const listMock = vi.hoisted(() => ({
  users: [] as AdminUserProfile[],
  invalidate: vi.fn()
}));
const apiMock = vi.hoisted(() => ({
  save: vi.fn()
}));
const swalMock = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn()
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => ({
    session: {
      user: {
        id: "current-admin",
        email: "current@example.invalid",
        name: "Current Admin",
        username: "current",
        role: authMock.role,
        isRoot: false
      }
    },
    capabilities: authMock.capabilities,
    hasCapability: (capability: CmsCapability) => authMock.capabilities.includes(capability)
  })
}));

vi.mock("../../features/admin-write/cloudflareApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-write/cloudflareApi")>()),
  saveAdminUserProfileToCloudflare: apiMock.save
}));

vi.mock("../../features/admin-pagination", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination")>()),
  useAdminListUrlState: () => ({
    page: 1,
    pageSize: 25,
    q: "",
    sortBy: "role",
    sortDirection: "asc",
    filters: { role: "all", status: "all" },
    setState: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSearch: vi.fn(),
    setFilter: vi.fn()
  }),
  useDebouncedValue: (value: unknown) => value,
  useAdminUserListQuery: (request: { role?: string; status?: string }) => {
    const items =
      request.role === "admin" && request.status === "active"
        ? listMock.users.filter((profile) => profile.role === "admin" && profile.status === "active")
        : listMock.users;
    return {
      data: {
        items,
        pagination: {
          page: 1,
          pageSize: 25,
          totalItems: items.length,
          totalPages: items.length ? 1 : 0,
          hasPreviousPage: false,
          hasNextPage: false
        }
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      isPlaceholderData: false
    };
  },
  invalidateAdminListQueries: listMock.invalidate
}));

vi.mock("../../utils/swal", () => ({
  appSwal: {
    fire: swalMock.fire,
    close: swalMock.close
  },
  showBlockingLoading: vi.fn(),
  showSuccessResult: swalMock.showSuccess,
  showErrorResult: swalMock.showError,
  getSwalErrorText: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)
}));

function profile(overrides: Partial<AdminUserProfile> = {}): AdminUserProfile {
  return {
    id: "managed-user",
    email: "managed@example.invalid",
    name: "Managed User",
    username: "managed",
    role: "editor",
    status: "active",
    isRoot: false,
    credentialConfigured: true,
    invitationStatus: "none",
    invitationExpiresAt: null,
    mfaConfigured: false,
    mfaRequired: false,
    recoveryCodesRemaining: 0,
    lastLoginAt: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
    revision: 4,
    ...overrides
  };
}

function renderCard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UserManagementCard />
    </QueryClientProvider>
  );
}

describe("UserManagementCard profile editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.capabilities = ["users.read-all", "users.update-any"];
    authMock.role = "admin";
    listMock.users = [
      profile(),
      profile({
        id: "current-admin",
        email: "current@example.invalid",
        name: "Current Admin",
        username: "current",
        role: "admin"
      })
    ];
    apiMock.save.mockResolvedValue(profile());
    listMock.invalidate.mockResolvedValue(undefined);
    swalMock.fire.mockResolvedValue({ isConfirmed: true });
    swalMock.close.mockResolvedValue(undefined);
    swalMock.showSuccess.mockResolvedValue(undefined);
    swalMock.showError.mockResolvedValue(undefined);
  });

  it("allows an Admin to edit existing email and username with the expected revision", async () => {
    renderCard();
    fireEvent.click(screen.getAllByRole("button", { name: "แก้ไข" })[0]);

    const email = screen.getByRole("textbox", { name: "อีเมล" });
    const username = screen.getByRole("textbox", { name: /ชื่อผู้ใช้/ });
    expect(email).toBeEnabled();
    expect(username).toBeEnabled();
    fireEvent.change(email, { target: { value: "updated@example.invalid" } });
    fireEvent.change(username, { target: { value: "updated.user" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() =>
      expect(apiMock.save).toHaveBeenCalledWith({
        id: "managed-user",
        email: "updated@example.invalid",
        name: "Managed User",
        username: "updated.user",
        role: "editor",
        status: "active",
        revision: 4
      })
    );
    expect(swalMock.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: "warning" }));
  });

  it("renders invitation and login timestamps through the shared Thai display policy", () => {
    listMock.users = [
      profile({
        invitationStatus: "pending",
        invitationExpiresAt: "2026-07-25T00:00:00.000Z",
        lastLoginAt: "2026-07-23T00:00:00.000Z"
      })
    ];

    renderCard();

    expect(screen.getByText("คำเชิญหมดอายุ: 25 กรกฎาคม 2569 07:00")).toBeInTheDocument();
    expect(screen.getByText("เข้าสู่ระบบล่าสุด: 23 กรกฎาคม 2569 07:00")).toBeInTheDocument();
  });

  it.each(["editor", "viewer"] as const)("does not expose editing to a %s without users.update-any", (role) => {
    authMock.role = role;
    authMock.capabilities = ["users.read-all"];
    renderCard();

    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
  });

  it("keeps Root role and status transitions disabled", () => {
    listMock.users = [profile({ id: "root-user", role: "admin", isRoot: true, mfaRequired: true })];
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "แก้ไข" }));

    const roleFields = screen.getAllByRole("combobox", { name: "บทบาท" });
    const statusFields = screen.getAllByRole("combobox", { name: "สถานะ" });
    expect(roleFields[roleFields.length - 1]).toHaveAttribute("aria-disabled", "true");
    expect(statusFields[statusFields.length - 1]).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/ไม่สามารถเปลี่ยนบทบาทหรือสถานะของ Root/)).toBeInTheDocument();
  });

  it("shows backend 403 and 409 failures without closing the edit form", async () => {
    apiMock.save.mockRejectedValueOnce(new Error("required permission is missing"));
    renderCard();
    fireEvent.click(screen.getAllByRole("button", { name: "แก้ไข" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อ" }), { target: { value: "Changed Name" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(await screen.findByText("required permission is missing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "บันทึก" })).toBeInTheDocument();

    apiMock.save.mockRejectedValueOnce(new Error("stale revision"));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(await screen.findByText("stale revision")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "บันทึก" })).toBeInTheDocument();
  });
});
