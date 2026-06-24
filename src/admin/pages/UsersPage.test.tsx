import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../../features/admin-write/cloudflareApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-write/cloudflareApi")>()),
  getAdminUsersFromCloudflare: cloudflareApiMock.getAdminUsersFromCloudflare,
  saveAdminUserProfileToCloudflare: cloudflareApiMock.saveAdminUserProfileToCloudflare,
  deleteAdminUserProfileFromCloudflare: cloudflareApiMock.deleteAdminUserProfileFromCloudflare
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

describe("UsersPage", () => {
  beforeEach(() => {
    authMock.role = "admin";
    cloudflareApiMock.users = [profile("admin"), profile("editor"), profile("viewer")];
    cloudflareApiMock.getAdminUsersFromCloudflare.mockReset();
    cloudflareApiMock.saveAdminUserProfileToCloudflare.mockReset();
    cloudflareApiMock.deleteAdminUserProfileFromCloudflare.mockReset();
    cloudflareApiMock.getAdminUsersFromCloudflare.mockImplementation(async () => cloudflareApiMock.users);
  });

  it("uses Cloudflare/D1 app-user profiles without Apps Script or password fields", async () => {
    render(<UsersPage />);

    expect(screen.getByRole("heading", { level: 1, name: "ผู้ใช้และสิทธิ์การเข้าถึง" })).toBeInTheDocument();
    expect(await screen.findByText("Cloudflare admin")).toBeInTheDocument();
    expect(screen.getAllByText(/Cloudflare\/D1|Cloudflare Access/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Legacy user management/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/VITE_GOOGLE_APPS_SCRIPT_URL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apps Script โดยตรง/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/รหัสผ่าน/)).not.toBeInTheDocument();
    await waitFor(() => expect(cloudflareApiMock.getAdminUsersFromCloudflare).toHaveBeenCalledTimes(1));
  });

  it("shows admin user management controls while preventing self-delete and last-admin removal", async () => {
    render(<UsersPage />);

    expect(await screen.findByRole("button", { name: "เพิ่มผู้ใช้" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "แก้ไข" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "ลบผู้ใช้" })).toHaveLength(3);
    expect(screen.getByText("ไม่สามารถลบบัญชีของตนเองได้")).toBeInTheDocument();
    expect(screen.getByText("ต้องมีผู้ดูแลระบบที่ใช้งานอย่างน้อยหนึ่งบัญชี")).toBeInTheDocument();
  });

  it("allows editors to edit only their own profile and hides role/status management", async () => {
    authMock.role = "editor";

    render(<UsersPage />);

    expect(await screen.findByText("Cloudflare editor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มผู้ใช้" })).not.toBeInTheDocument();
    expect(screen.getAllByText("บัญชีนี้ไม่มีสิทธิ์แก้ไขผู้ใช้อื่น").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "แก้ไข" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "ลบผู้ใช้" })).not.toBeInTheDocument();
  });

  it("renders viewer as read-only with no create edit or delete controls", async () => {
    authMock.role = "viewer";

    render(<UsersPage />);

    expect(await screen.findByText("Cloudflare viewer")).toBeInTheDocument();
    expect(
      screen.getByText("บัญชี viewer สามารถดูข้อมูลเพื่อตรวจสอบก่อนเผยแพร่ได้ แต่ไม่สามารถแก้ไขข้อมูลได้")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มผู้ใช้" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบผู้ใช้" })).not.toBeInTheDocument();
    expect(screen.getAllByText("บัญชี viewer สามารถดูข้อมูลได้เท่านั้น").length).toBeGreaterThan(0);
  });
});
