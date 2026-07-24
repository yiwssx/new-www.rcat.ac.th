import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountSecurityPage from "./AccountSecurityPage";

const apiMock = vi.hoisted(() => ({
  getMe: vi.fn(),
  regenerate: vi.fn()
}));
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

vi.mock("../../features/admin-write/cloudflareApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/admin-write/cloudflareApi")>();
  return { ...actual, getCurrentAdminUserFromCloudflare: apiMock.getMe };
});

vi.mock("../../features/cms-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/cms-auth")>();
  return { ...actual, regenerateCmsRecoveryCodes: apiMock.regenerate };
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

describe("AccountSecurityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.hasCapability.mockReturnValue(true);
    apiMock.getMe.mockResolvedValue({
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
      revision: 2
    });
    apiMock.regenerate.mockResolvedValue(Array.from({ length: 10 }, (_, index) => `NEW-CODE-${index}`));
  });

  it("shows safe lifecycle state and displays regenerated Recovery Codes exactly once", async () => {
    renderPage();

    expect(await screen.findByText("ชื่อ: Secure User")).toBeInTheDocument();
    expect(screen.queryByText(/sessionId|sessionVersion|mfaVerifiedAt/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "สร้างรหัสกู้คืนชุดใหม่" }));

    await waitFor(() => expect(apiMock.regenerate).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("NEW-CODE-0")).toBeInTheDocument();
    expect(screen.getAllByText(/NEW-CODE-/)).toHaveLength(10);
  });

  it("disables MFA removal for Root and required accounts", async () => {
    apiMock.getMe.mockResolvedValue({
      ...(await apiMock.getMe()),
      isRoot: true,
      mfaRequired: true
    });
    renderPage();

    expect(await screen.findByText(/ไม่สามารถปิด MFA สำหรับบัญชี Root/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ปิด MFA" })).toBeDisabled();
  });
});
