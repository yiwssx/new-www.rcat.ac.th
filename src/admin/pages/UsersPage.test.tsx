import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "./UsersPage";
import type { AdminUserProfile } from "../../features/admin-write/cloudflareApi";
import type { Session, User } from "../../types";

const authMock = vi.hoisted(() => ({
  role: "admin" as User["role"]
}));

const cloudflareApiMock = vi.hoisted(() => ({
  users: [] as AdminUserProfile[],
  getAdminUsersFromCloudflare: vi.fn(),
  saveAdminUserProfileToCloudflare: vi.fn(),
  deleteAdminUserProfileFromCloudflare: vi.fn()
}));

const paginationMock = vi.hoisted(() => ({ getAdminUserList: vi.fn() }));

const swalInstance = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn()
}));

vi.mock("sweetalert2", () => ({
  default: {
    mixin: vi.fn(() => swalInstance)
  }
}));

vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

vi.mock("../../features/admin-write/cloudflareApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-write/cloudflareApi")>()),
  getAdminUsersFromCloudflare: cloudflareApiMock.getAdminUsersFromCloudflare,
  saveAdminUserProfileToCloudflare: cloudflareApiMock.saveAdminUserProfileToCloudflare,
  deleteAdminUserProfileFromCloudflare: cloudflareApiMock.deleteAdminUserProfileFromCloudflare
}));

vi.mock("../../features/admin-pagination/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination/api")>()),
  getAdminUserList: paginationMock.getAdminUserList
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => {
    const user: User = {
      id: `cloudflare-${authMock.role}`,
      name: `Cloudflare ${authMock.role}`,
      email: `${authMock.role}@example.invalid`,
      role: authMock.role
    };
    const session: Session = {
      user,
      token: "test-session-token",
      expiresAt: "2026-06-23T00:00:00.000Z"
    };

    return {
      session,
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

function profile(role: User["role"], overrides: Partial<AdminUserProfile> = {}): AdminUserProfile {
  return {
    id: `${role}-profile`,
    email: `${role}@example.invalid`,
    name: `Cloudflare ${role}`,
    role,
    status: "active",
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z",
    revision: 0,
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function findSwalCall(predicate: (options: Record<string, unknown>) => boolean) {
  const call = swalInstance.fire.mock.calls.find(([options]) => {
    if (!options || typeof options !== "object") {
      return false;
    }

    return predicate(options as Record<string, unknown>);
  });

  return call?.[0] as Record<string, unknown> | undefined;
}

function renderUsersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>
  );
}

describe("UsersPage", () => {
  beforeEach(() => {
    authMock.role = "admin";
    cloudflareApiMock.users = [profile("admin"), profile("editor"), profile("viewer")];
    cloudflareApiMock.getAdminUsersFromCloudflare.mockReset();
    cloudflareApiMock.saveAdminUserProfileToCloudflare.mockReset();
    cloudflareApiMock.deleteAdminUserProfileFromCloudflare.mockReset();
    cloudflareApiMock.getAdminUsersFromCloudflare.mockImplementation(async () => cloudflareApiMock.users);
    cloudflareApiMock.saveAdminUserProfileToCloudflare.mockResolvedValue(profile("viewer", { id: "new-user" }));
    cloudflareApiMock.deleteAdminUserProfileFromCloudflare.mockResolvedValue({ id: "editor-profile", deleted: true });
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);
    swalInstance.showLoading.mockReset();
    paginationMock.getAdminUserList.mockReset();
    paginationMock.getAdminUserList.mockImplementation(async (request = {}) => {
      const query = request as { q?: string; role?: User["role"] | "all"; status?: "active" | "disabled" | "all" };
      const q = query.q?.toLowerCase() ?? "";
      const items = cloudflareApiMock.users.filter(
        (item) =>
          (!q || `${item.name} ${item.email}`.toLowerCase().includes(q)) &&
          (!query.role || query.role === "all" || item.role === query.role) &&
          (!query.status || query.status === "all" || item.status === query.status)
      );

      return {
        items,
        pagination: {
          page: 1,
          pageSize: 25,
          totalItems: items.length,
          totalPages: items.length ? 1 : 0,
          hasPreviousPage: false,
          hasNextPage: false
        },
        generatedAt: "2026-07-13T00:00:00.000Z"
      };
    });
  });

  it("uses Cloudflare/D1 app-user profiles without Apps Script or password fields", async () => {
    renderUsersPage();

    expect(screen.getByRole("heading", { level: 1, name: "ผู้ใช้และสิทธิ์การเข้าถึง" })).toBeInTheDocument();
    expect(await screen.findByText("Cloudflare admin")).toBeInTheDocument();
    expect(screen.getAllByText(/Cloudflare\/D1|Cloudflare Access/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Legacy user management/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/VITE_GOOGLE_APPS_SCRIPT_URL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apps Script โดยตรง/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/รหัสผ่าน/)).not.toBeInTheDocument();
    await waitFor(() => expect(paginationMock.getAdminUserList).toHaveBeenCalled());
  });

  it("shows admin user management controls while preventing self-delete and last-admin removal", async () => {
    renderUsersPage();

    await screen.findByText("Cloudflare admin");
    expect(await screen.findByRole("button", { name: "เพิ่มผู้ใช้" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "แก้ไข" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "ลบผู้ใช้" })).toHaveLength(3);
    expect(screen.getByText("ไม่สามารถลบบัญชีของตนเองได้")).toBeInTheDocument();
    expect(screen.getByText("ต้องมีผู้ดูแลระบบที่ใช้งานอย่างน้อยหนึ่งบัญชี")).toBeInTheDocument();
  });

  it("allows editors to edit only their own profile and hides role/status management", async () => {
    authMock.role = "editor";

    renderUsersPage();

    expect(await screen.findByText("Cloudflare editor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มผู้ใช้" })).not.toBeInTheDocument();
    expect(screen.getAllByText("บัญชีนี้ไม่มีสิทธิ์แก้ไขผู้ใช้อื่น").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "แก้ไข" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "ลบผู้ใช้" })).not.toBeInTheDocument();
  });

  it("renders viewer as read-only with no create edit or delete controls", async () => {
    authMock.role = "viewer";

    renderUsersPage();

    expect(await screen.findByText("Cloudflare viewer")).toBeInTheDocument();
    expect(
      screen.getByText("บัญชี viewer สามารถดูข้อมูลเพื่อตรวจสอบก่อนเผยแพร่ได้ แต่ไม่สามารถแก้ไขข้อมูลได้")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มผู้ใช้" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบผู้ใช้" })).not.toBeInTheDocument();
    expect(screen.getAllByText("บัญชี viewer สามารถดูข้อมูลได้เท่านั้น").length).toBeGreaterThan(0);
  });

  it("shows loading and an acknowledged success modal when saving a user", async () => {
    const save = deferred<AdminUserProfile>();
    const savedProfile = profile("viewer", {
      id: "new-user",
      email: "new-user@example.invalid",
      name: "New User"
    });
    cloudflareApiMock.saveAdminUserProfileToCloudflare.mockReturnValue(save.promise);
    renderUsersPage();

    await screen.findByText("Cloudflare editor");
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มผู้ใช้" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อ" }), {
      target: { value: savedProfile.name }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "อีเมล" }), {
      target: { value: savedProfile.email }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้ใช้" }));

    await waitFor(() => expect(cloudflareApiMock.saveAdminUserProfileToCloudflare).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "กำลังบันทึก" })).toBeDisabled();
    expect(findSwalCall((options) => options.title === "กำลังบันทึกผู้ใช้")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );

    save.resolve(savedProfile);

    let successModal: Record<string, unknown> | undefined;
    await waitFor(() => {
      successModal = findSwalCall((options) => options.title === "บันทึกผู้ใช้สำเร็จ");
      expect(successModal).toEqual(
        expect.objectContaining({
          icon: "success",
          title: "บันทึกผู้ใช้สำเร็จ",
          confirmButtonText: "ตกลง"
        })
      );
    });
    expect(successModal).not.toHaveProperty("toast");
    expect(successModal).not.toHaveProperty("timer");
  });

  it("shows loading and an acknowledged success modal when deleting a user", async () => {
    const deletion = deferred<{ id: string; deleted: boolean }>();
    cloudflareApiMock.deleteAdminUserProfileFromCloudflare.mockReturnValue(deletion.promise);
    renderUsersPage();

    await screen.findByText("Cloudflare editor");
    fireEvent.click(screen.getAllByRole("button", { name: "ลบผู้ใช้" })[1]);

    await waitFor(() =>
      expect(cloudflareApiMock.deleteAdminUserProfileFromCloudflare).toHaveBeenCalledWith({
        id: "editor-profile",
        revision: 0
      })
    );
    expect(findSwalCall((options) => options.title === "กำลังลบผู้ใช้")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );
    for (const button of screen.getAllByRole("button", { name: "ลบผู้ใช้" })) {
      expect(button).toBeDisabled();
    }

    deletion.resolve({ id: "editor-profile", deleted: true });

    let successModal: Record<string, unknown> | undefined;
    await waitFor(() => {
      successModal = findSwalCall((options) => options.title === "ลบผู้ใช้สำเร็จ");
      expect(successModal).toEqual(
        expect.objectContaining({
          icon: "success",
          title: "ลบผู้ใช้สำเร็จ",
          confirmButtonText: "ตกลง"
        })
      );
    });
    expect(successModal).not.toHaveProperty("toast");
    expect(successModal).not.toHaveProperty("timer");
  });

  it("keeps the inline user error and shows an acknowledged error modal when saving fails", async () => {
    cloudflareApiMock.saveAdminUserProfileToCloudflare.mockRejectedValue(new Error("User revision mismatch"));
    renderUsersPage();

    await screen.findByText("Cloudflare editor");
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มผู้ใช้" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อ" }), {
      target: { value: "New User" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "อีเมล" }), {
      target: { value: "new-user@example.invalid" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้ใช้" }));

    expect(await screen.findByText("User revision mismatch")).toBeInTheDocument();
    expect(findSwalCall((options) => options.title === "ไม่สามารถบันทึกผู้ใช้ได้")).toEqual(
      expect.objectContaining({
        icon: "error",
        title: "ไม่สามารถบันทึกผู้ใช้ได้",
        text: "User revision mismatch",
        confirmButtonText: "ตกลง"
      })
    );
  });
});
