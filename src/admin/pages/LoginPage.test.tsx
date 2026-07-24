import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

const authMock = vi.hoisted(() => ({
  status: "unauthenticated" as "unauthenticated" | "authenticated",
  login: vi.fn(),
  verifyMfa: vi.fn(),
  refreshSession: vi.fn()
}));
const navigateMock = vi.hoisted(() => vi.fn());
const clientMock = vi.hoisted(() => ({
  startSetup: vi.fn(),
  confirmSetup: vi.fn()
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    Navigate: ({ to }: { to: string }) => <span>redirect:{to}</span>
  };
});

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => ({
    status: authMock.status,
    login: authMock.login,
    verifyMfa: authMock.verifyMfa,
    refreshSession: authMock.refreshSession
  })
}));

vi.mock("../../features/cms-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/cms-auth")>();
  return {
    ...actual,
    startCmsMfaSetup: clientMock.startSetup,
    confirmCmsMfaSetup: clientMock.confirmSetup,
    consumeCmsSessionNotice: () => ""
  };
});

vi.mock("../../utils/swal", () => ({
  appSwal: { fire: vi.fn(async () => ({ isConfirmed: true })) }
}));

describe("CMS LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    authMock.status = "unauthenticated";
    authMock.login.mockResolvedValue({ kind: "authenticated" });
    authMock.verifyMfa.mockResolvedValue({});
    authMock.refreshSession.mockResolvedValue({});
    clientMock.startSetup.mockResolvedValue({
      manualEntryKey: "MANUAL-ENTRY-KEY",
      otpAuthUri: "otpauth://totp/RCAT:test.user?issuer=RCAT",
      expiresAt: "2026-07-25T00:00:00.000Z"
    });
    clientMock.confirmSetup.mockResolvedValue({
      recoveryCodes: Array.from({ length: 10 }, (_, index) => `RECOVERY-${index}`),
      loginRequired: false
    });
  });

  it("sends the password exactly and navigates after password-only success", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/อีเมลหรือชื่อผู้ใช้/), "admin");
    await user.type(screen.getByLabelText(/รหัสผ่าน/), " password ");
    await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

    await waitFor(() => {
      expect(authMock.login).toHaveBeenCalledWith("admin", " password ");
      expect(navigateMock).toHaveBeenCalledWith({ to: "/admin", replace: true });
    });
  });

  it("enters TOTP mode for a 202 MFA challenge", async () => {
    authMock.login.mockResolvedValue({
      kind: "challenge",
      mfaRequired: true,
      enrollmentRequired: false
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/อีเมลหรือชื่อผู้ใช้/), { target: { value: "editor" } });
    fireEvent.change(screen.getByLabelText(/รหัสผ่าน/), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

    expect(await screen.findByRole("heading", { name: "ยืนยัน MFA" })).toBeInTheDocument();
    expect(screen.getByLabelText(/รหัส 6 หลัก/)).toHaveAttribute("inputmode", "numeric");
  });

  it("submits a Recovery Code without persisting it", async () => {
    authMock.login.mockResolvedValue({
      kind: "challenge",
      mfaRequired: true,
      enrollmentRequired: false
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/อีเมลหรือชื่อผู้ใช้/), { target: { value: "viewer" } });
    fireEvent.change(screen.getByLabelText(/รหัสผ่าน/), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    await screen.findByRole("heading", { name: "ยืนยัน MFA" });

    fireEvent.click(screen.getByRole("radio", { name: "รหัสกู้คืน" }));
    fireEvent.change(screen.getByRole("textbox", { name: /รหัสกู้คืน/ }), {
      target: { value: "KEEP-EXACT-CODE" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันและเข้าสู่ระบบ" }));

    await waitFor(() => {
      expect(authMock.verifyMfa).toHaveBeenCalledWith({ recoveryCode: "KEEP-EXACT-CODE" });
    });
    expect(JSON.stringify(window.localStorage)).not.toContain("KEEP-EXACT-CODE");
    expect(JSON.stringify(window.sessionStorage)).not.toContain("KEEP-EXACT-CODE");
  });

  it("shows the mandatory enrollment key and exactly ten one-time Recovery Codes", async () => {
    authMock.login.mockResolvedValue({
      kind: "challenge",
      mfaRequired: true,
      enrollmentRequired: true
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/อีเมลหรือชื่อผู้ใช้/), { target: { value: "root" } });
    fireEvent.change(screen.getByLabelText(/รหัสผ่าน/), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));

    expect(await screen.findByDisplayValue("MANUAL-ENTRY-KEY")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/รหัสจากแอป 6 หลัก/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันการตั้งค่า" }));

    expect(await screen.findByText("RECOVERY-0")).toBeInTheDocument();
    expect(screen.getAllByText(/RECOVERY-/)).toHaveLength(10);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("redirects an authenticated user without rendering the password form", () => {
    authMock.status = "authenticated";
    render(<LoginPage />);

    expect(screen.getByText("redirect:/admin")).toBeInTheDocument();
    expect(screen.queryByLabelText(/รหัสผ่าน/)).not.toBeInTheDocument();
  });
});
