import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUserProfile } from "../../features/admin-write/cloudflareApi";
import type { CmsCapability } from "../../features/cms-auth";
import UsersPage from "./UsersPage";

const authMock = vi.hoisted(() => ({
  capabilities: [] as CmsCapability[]
}));

const apiMock = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  invite: vi.fn(),
  revokeInvitation: vi.fn(),
  resetPassword: vi.fn(),
  revokeSessions: vi.fn(),
  requireMfa: vi.fn(),
  resetMfa: vi.fn()
}));

const listMock = vi.hoisted(() => ({
  users: [] as AdminUserProfile[],
  invalidate: vi.fn(),
  setPage: vi.fn()
}));

const swalMock = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn()
}));

vi.mock("sweetalert2", () => ({
  default: { mixin: vi.fn(() => swalMock) }
}));
vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => ({
    session: {
      user: {
        id: "current-admin",
        email: "admin@example.invalid",
        name: "Current Admin",
        role: "admin",
        status: "active",
        isRoot: false,
        credentialConfigured: true,
        mfaConfigured: true,
        mfaRequired: true,
        recoveryCodesRemaining: 8,
        recentPasswordAuthentication: true,
        recentMfaAuthentication: true
      }
    },
    capabilities: authMock.capabilities,
    hasCapability: (capability: CmsCapability) => authMock.capabilities.includes(capability)
  })
}));

vi.mock("../../features/admin-write/cloudflareApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-write/cloudflareApi")>()),
  createAdminUserWithInvitationToCloudflare: apiMock.create,
  saveAdminUserProfileToCloudflare: apiMock.save,
  deleteAdminUserProfileFromCloudflare: apiMock.remove,
  issueAdminUserInvitationFromCloudflare: apiMock.invite,
  revokeAdminUserInvitationFromCloudflare: apiMock.revokeInvitation,
  issueAdminUserPasswordResetFromCloudflare: apiMock.resetPassword,
  revokeAdminUserSessionsFromCloudflare: apiMock.revokeSessions,
  setAdminUserMfaRequirementFromCloudflare: apiMock.requireMfa,
  resetAdminUserMfaFromCloudflare: apiMock.resetMfa
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
    setPage: listMock.setPage,
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
        },
        generatedAt: "2026-07-24T00:00:00.000Z"
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      isPlaceholderData: false
    };
  },
  invalidateAdminListQueries: listMock.invalidate
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
    mfaConfigured: true,
    mfaRequired: false,
    recoveryCodesRemaining: 7,
    lastLoginAt: "2026-07-23T00:00:00.000Z",
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
    revision: 2,
    ...overrides
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>
  );
}

const lifecycleCapabilities: CmsCapability[] = [
  "users.read-all",
  "users.create",
  "users.update-any",
  "users.delete",
  "users.invite",
  "users.reset-password",
  "users.revoke-sessions",
  "users.mfa.require",
  "users.mfa.reset"
];

describe("UsersPage CMS lifecycle", () => {
  beforeEach(() => {
    authMock.capabilities = [...lifecycleCapabilities];
    listMock.users = [profile(), profile({ id: "current-admin", name: "Current Admin", role: "admin" })];
    vi.clearAllMocks();
    swalMock.fire.mockResolvedValue({ isConfirmed: true });
    swalMock.close.mockResolvedValue(undefined);
    listMock.invalidate.mockResolvedValue(undefined);
    apiMock.create.mockResolvedValue({
      item: profile({ id: "new-user" }),
      invitation: {
        token: "one-time-invitation-token",
        expiresAt: "2026-07-25T00:00:00.000Z"
      }
    });
    apiMock.revokeSessions.mockResolvedValue(undefined);
    apiMock.resetMfa.mockResolvedValue(undefined);
  });

  it("renders only safe Cloudflare/D1 lifecycle fields", () => {
    renderPage();

    expect(screen.getByText("Managed User")).toBeInTheDocument();
    expect(screen.getAllByText(/credential:/)).toHaveLength(2);
    expect(screen.queryByLabelText(/รหัสผ่าน/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apps Script โดยตรง/)).not.toBeInTheDocument();
  });

  it("hides every lifecycle mutation when capabilities are absent", () => {
    authMock.capabilities = [];
    renderPage();

    expect(screen.getByText(/มีสิทธิ์อ่านข้อมูลเท่านั้น/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มผู้ใช้" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบผู้ใช้" })).not.toBeInTheDocument();
  });

  it("keeps Root destructive controls disabled", () => {
    listMock.users = [
      profile({
        id: "root-user",
        name: "Root User",
        role: "admin",
        isRoot: true,
        mfaRequired: true
      })
    ];
    renderPage();

    expect(screen.getByText(/Root User/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ลบผู้ใช้" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "รีเซ็ต MFA" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ยกเลิกบังคับ MFA" })).toBeDisabled();
  });

  it("creates a user atomically and displays the invitation token only until acknowledged", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "เพิ่มผู้ใช้" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อ" }), {
      target: { value: "New User" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "อีเมล" }), {
      target: { value: "new@example.invalid" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() =>
      expect(apiMock.create).toHaveBeenCalledWith({
        email: "new@example.invalid",
        name: "New User",
        role: "viewer",
        username: null
      })
    );
    expect(await screen.findByDisplayValue("one-time-invitation-token")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /จัดเก็บโทเค็นแล้ว/ }));
    expect(screen.queryByDisplayValue("one-time-invitation-token")).not.toBeInTheDocument();
  }, 15_000);

  it("requires confirmation before revoking all user sessions", async () => {
    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: "เพิกถอนเซสชัน" })[0]);

    await waitFor(() => expect(apiMock.revokeSessions).toHaveBeenCalledWith("managed-user"));
    expect(swalMock.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: "warning", showCancelButton: true }));
  });
});
