import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CmsAuthError, cmsStepUpCoordinator } from "../../features/cms-auth";
import AccountSecurityPage from "./AccountSecurityPage";

const apiMock = vi.hoisted(() => ({
  getMe: vi.fn(),
  regenerate: vi.fn(),
  startSetup: vi.fn(),
  confirmSetup: vi.fn(),
  disableMfa: vi.fn()
}));
const handoffMock = vi.hoisted(() => ({ begin: vi.fn() }));
const navigateMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => ({
  clearSession: vi.fn(),
  logout: vi.fn(),
  logoutAll: vi.fn(),
  hasCapability: vi.fn(() => true)
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => authMock
}));

vi.mock("../../context/RecoveryCodeHandoffContext", () => ({
  useRecoveryCodeHandoff: () => ({
    beginRecoveryCodeHandoff: handoffMock.begin
  })
}));

vi.mock("../../features/admin-write/cloudflareApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/admin-write/cloudflareApi")>();
  return { ...actual, getCurrentAdminUserFromCloudflare: apiMock.getMe };
});

vi.mock("../../features/cms-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/cms-auth")>();
  return {
    ...actual,
    regenerateCmsRecoveryCodes: apiMock.regenerate,
    startCmsMfaSetup: apiMock.startSetup,
    confirmCmsMfaSetup: apiMock.confirmSetup,
    disableCmsMfa: apiMock.disableMfa
  };
});

vi.mock("../../utils/swal", () => ({
  appSwal: { fire: vi.fn(async () => ({ isConfirmed: true })) },
  showSuccessResult: vi.fn(async () => undefined)
}));

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountSecurityPage />
    </QueryClientProvider>
  );
}

function createAdminProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user@example.test",
    name: "Secure User",
    username: "secure.user",
    role: "admin",
    status: "active",
    isRoot: false,
    mfaRequired: false,
    mfaConfigured: true,
    mfaEnabledAt: "2026-07-20T00:00:00.000Z",
    recoveryCodesRemaining: 4,
    lastLoginAt: "2026-07-24T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
    revision: 2,
    ...overrides
  };
}

describe("AccountSecurityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cmsStepUpCoordinator.resetForTests();
    authMock.hasCapability.mockReturnValue(true);
    apiMock.getMe.mockResolvedValue(createAdminProfile());
    apiMock.regenerate.mockResolvedValue(Array.from({ length: 10 }, (_, index) => `NEW-CODE-${index}`));
    apiMock.startSetup.mockResolvedValue({
      manualEntryKey: "MANUAL-ENTRY-KEY",
      otpAuthUri: "otpauth://totp/RCAT:secure.user",
      expiresAt: "2026-07-25T00:00:00.000Z"
    });
    apiMock.confirmSetup.mockResolvedValue({
      recoveryCodes: Array.from({ length: 10 }, (_, index) => `VOLUNTARY-${index}`),
      loginRequired: true
    });
    apiMock.disableMfa.mockResolvedValue(undefined);
  });

  it("shows safe lifecycle state and hands regenerated Recovery Codes to the blocking flow", async () => {
    renderPage();

    expect(await screen.findByText("ชื่อ: Secure User")).toBeInTheDocument();
    expect(screen.queryByText(/sessionId|sessionVersion|mfaVerifiedAt/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "สร้างรหัสกู้คืนชุดใหม่" }));

    await waitFor(() => expect(apiMock.regenerate).toHaveBeenCalledTimes(1));
    expect(handoffMock.begin).toHaveBeenCalledWith({
      codes: Array.from({ length: 10 }, (_, index) => `NEW-CODE-${index}`),
      mode: "regenerated"
    });
  });

  it("requests password step-up for voluntary setup and retries only once", async () => {
    apiMock.getMe.mockResolvedValue(createAdminProfile({ mfaConfigured: false }));
    apiMock.startSetup.mockRejectedValueOnce(new CmsAuthError(428)).mockResolvedValueOnce({
      manualEntryKey: "STEP-UP-KEY",
      otpAuthUri: "otpauth://totp/RCAT:secure.user",
      expiresAt: "2026-07-25T00:00:00.000Z"
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "ตั้งค่า MFA" }));
    await waitFor(() => expect(cmsStepUpCoordinator.getSnapshot()).toEqual({ open: true, assurance: "password" }));
    cmsStepUpCoordinator.complete();

    expect(await screen.findByDisplayValue("STEP-UP-KEY")).toBeInTheDocument();
    expect(apiMock.startSetup).toHaveBeenCalledTimes(2);
  });

  it("moves voluntary enrollment codes to the application handoff and suspends the local Session shell", async () => {
    apiMock.getMe.mockResolvedValue(createAdminProfile({ mfaConfigured: false }));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "ตั้งค่า MFA" }));
    fireEvent.change(await screen.findByLabelText(/รหัสจากแอป 6 หลัก/), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันการตั้งค่า" }));

    await waitFor(() =>
      expect(handoffMock.begin).toHaveBeenCalledWith({
        codes: Array.from({ length: 10 }, (_, index) => `VOLUNTARY-${index}`),
        mode: "voluntary"
      })
    );
    expect(apiMock.confirmSetup).toHaveBeenCalledWith("session", "123456");
    expect(authMock.clearSession).toHaveBeenCalledWith();
  });

  it("requests MFA step-up for self-disable, retries once, and clears proof fields", async () => {
    apiMock.disableMfa.mockRejectedValueOnce(new CmsAuthError(428)).mockResolvedValueOnce(undefined);
    renderPage();

    const passwordFields = await screen.findAllByLabelText(/รหัสผ่านปัจจุบัน/);
    const disablePassword = passwordFields[passwordFields.length - 1] as HTMLInputElement;
    const factor = screen.getByLabelText(/รหัสจากแอป 6 หลัก/) as HTMLInputElement;
    fireEvent.change(disablePassword, { target: { value: "exact password" } });
    fireEvent.change(factor, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "ปิด MFA" }));

    await waitFor(() => expect(cmsStepUpCoordinator.getSnapshot()).toEqual({ open: true, assurance: "mfa" }));
    cmsStepUpCoordinator.complete();

    await waitFor(() => expect(apiMock.disableMfa).toHaveBeenCalledTimes(2));
    expect(apiMock.disableMfa).toHaveBeenLastCalledWith({
      currentPassword: "exact password",
      totpCode: "123456"
    });
    await waitFor(() => {
      expect(disablePassword).toHaveValue("");
      expect(factor).toHaveValue("");
    });
  });

  it("disables MFA removal for Root and required accounts", async () => {
    apiMock.getMe.mockResolvedValue(createAdminProfile({ isRoot: true, mfaRequired: true }));
    renderPage();

    expect(await screen.findByText(/ไม่สามารถปิด MFA สำหรับบัญชี Root/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ปิด MFA" })).toBeDisabled();
  });
});
