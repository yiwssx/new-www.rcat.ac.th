import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CmsShell from "./CmsShell";

const navigateMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => ({
  capabilities: ["dashboard.read", "content.read", "users.read-self"],
  logout: vi.fn(),
  reauthenticate: vi.fn(),
  session: {
    user: {
      id: "viewer-1",
      email: "viewer@example.test",
      name: "Viewer",
      username: "viewer",
      role: "viewer",
      isRoot: false,
      recentPasswordAuthentication: false,
      recentMfaAuthentication: false
    }
  }
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Outlet: () => <div>page content</div>,
    useNavigate: () => navigateMock,
    useRouterState: () => "/admin"
  };
});

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => authMock
}));

vi.mock("../../utils/swal", () => ({
  appSwal: { fire: vi.fn(async () => ({ isConfirmed: true })) }
}));

describe("CmsShell capability navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.logout.mockResolvedValue(undefined);
  });

  it("shows only navigation backed by server capabilities", () => {
    render(<CmsShell />);

    expect(screen.getByText("แดชบอร์ด")).toBeInTheDocument();
    expect(screen.getByText("เนื้อหา")).toBeInTheDocument();
    expect(screen.getByText("ความปลอดภัยบัญชี")).toBeInTheDocument();
    expect(screen.queryByText("ผู้ใช้งาน")).not.toBeInTheDocument();
    expect(screen.queryByText("สำรองข้อมูล")).not.toBeInTheDocument();
  });

  it("navigates to Login even when server Logout fails", async () => {
    authMock.logout.mockRejectedValueOnce(new Error("network"));
    render(<CmsShell />);

    fireEvent.click(screen.getByRole("button", { name: "เปิดเมนูนำทาง" }));
    fireEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/login", replace: true });
    });
  });
});
