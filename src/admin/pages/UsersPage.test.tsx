import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "./UsersPage";
import type { Session, User } from "../../types";

const authMock = vi.hoisted(() => ({
  role: "admin" as User["role"]
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

describe("UsersPage", () => {
  beforeEach(() => {
    authMock.role = "admin";
  });

  it("explains Cloudflare Access RBAC without requiring Apps Script user management", () => {
    render(<UsersPage />);

    expect(screen.getByRole("heading", { level: 1, name: "ผู้ใช้และสิทธิ์การเข้าถึง" })).toBeInTheDocument();
    expect(screen.getAllByText(/Cloudflare Access/).length).toBeGreaterThan(0);
    expect(screen.getByText(/ADMIN_RBAC_ADMINS/)).toBeInTheDocument();
    expect(screen.getAllByText(/admin@example.invalid/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Legacy user management/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/VITE_GOOGLE_APPS_SCRIPT_URL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Apps Script โดยตรง/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /เพิ่มผู้ใช้|รีเซ็ตผู้ใช้|บันทึกผู้ใช้|ลบผู้ใช้/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/รหัสผ่าน/)).not.toBeInTheDocument();
  });

  it("shows read-only Cloudflare RBAC guidance for editor and viewer sessions", () => {
    authMock.role = "editor";

    render(<UsersPage />);

    expect(screen.getByText("บัญชีนี้เป็นสิทธิ์อ่านอย่างเดียว ไม่สามารถแก้ไขข้อมูลได้")).toBeInTheDocument();
    expect(screen.getByText(/editor และ viewer เป็นสิทธิ์อ่านอย่างเดียว/)).toBeInTheDocument();
  });
});
