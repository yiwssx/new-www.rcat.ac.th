import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkMediaBridgeStatus, MediaBridgeRequestError } from "../../features/cms-media/mediaBridgeClient";
import type { CmsAuthStatus, CmsCapability } from "../../features/cms-auth";
import IntegrationsPage from "./IntegrationsPage";

const authMock = vi.hoisted(() => ({
  status: "authenticated" as CmsAuthStatus,
  capabilities: ["media.read"] as CmsCapability[],
  session: {
    user: {
      id: "root-user",
      email: "root@example.invalid",
      name: "Root",
      username: "root",
      role: "admin" as const,
      isRoot: true,
      recentPasswordAuthentication: true,
      recentMfaAuthentication: true
    }
  }
}));

vi.mock("../../config/adminWriteProvider", () => ({
  getAdminWriteProvider: () => "cloudflare"
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => authMock
}));

vi.mock("../../features/cms-media/mediaBridgeClient", () => ({
  checkMediaBridgeStatus: vi.fn(),
  MediaBridgeRequestError: class extends Error {
    constructor(
      message: string,
      readonly httpStatus: number
    ) {
      super(message);
    }
  }
}));

const checkMediaBridgeStatusMock = vi.mocked(checkMediaBridgeStatus);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntegrationsPage />
    </QueryClientProvider>
  );
}

describe("IntegrationsPage", () => {
  beforeEach(() => {
    checkMediaBridgeStatusMock.mockReset();
    authMock.status = "authenticated";
    authMock.capabilities = ["media.read"];
  });

  it("lets an authenticated CMS Root query status without any browser Session token", async () => {
    checkMediaBridgeStatusMock.mockResolvedValue({
      mode: "server-proxy",
      appsScriptBridge: "connected",
      driveStorage: "connected"
    });

    renderPage();

    expect(await screen.findByText("Cloudflare structured data")).toBeInTheDocument();
    expect(screen.getAllByText(/เชื่อมต่อผ่าน Vercel Apps Script Proxy/).length).toBeGreaterThan(0);
    expect(checkMediaBridgeStatusMock).toHaveBeenCalledTimes(1);
    expect(document.body).not.toHaveTextContent("VITE_GOOGLE_APPS_SCRIPT_URL");
    expect(document.body).not.toHaveTextContent("กรุณาเข้าสู่ระบบใหม่เพื่อตรวจสอบสถานะสะพานสื่อ");
  });

  it("shows a finite configuration state when the server-side bridge is not configured", async () => {
    checkMediaBridgeStatusMock.mockResolvedValue({
      mode: "server-proxy",
      appsScriptBridge: "not-configured",
      driveStorage: "not-configured"
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("ยังไม่ได้กำหนดค่าฝั่งเซิร์ฟเวอร์"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("appsScriptUrlConfigured");
    expect(screen.getByRole("alert")).not.toHaveTextContent("bridgeTokenConfigured");
  });

  it("shows CMS Session expiry separately from authorization and upstream failures", async () => {
    checkMediaBridgeStatusMock.mockRejectedValue(new MediaBridgeRequestError("expired", 401));

    renderPage();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("เซสชัน CMS หมดอายุ"));
  });

  it("shows a capability denial without describing it as Session expiry", async () => {
    checkMediaBridgeStatusMock.mockRejectedValue(new MediaBridgeRequestError("forbidden", 403));

    renderPage();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("ไม่มีสิทธิ์ตรวจสอบสถานะสะพานสื่อ"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("เซสชัน CMS หมดอายุ");
  });

  it("shows an upstream-unavailable state without describing it as Session expiry", async () => {
    checkMediaBridgeStatusMock.mockRejectedValue(new MediaBridgeRequestError("unavailable", 503));

    renderPage();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("ไม่สามารถตรวจสอบสถานะสะพานสื่อ"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("เซสชัน CMS หมดอายุ");
  });

  it("does not query before CMS authentication or without media.read", () => {
    authMock.status = "bootstrapping";
    renderPage();
    expect(checkMediaBridgeStatusMock).not.toHaveBeenCalled();

    authMock.status = "authenticated";
    authMock.capabilities = [];
    renderPage();
    expect(checkMediaBridgeStatusMock).not.toHaveBeenCalled();
    expect(screen.getByText("บัญชีนี้ไม่มีสิทธิ์ตรวจสอบสถานะสะพานสื่อ")).toBeInTheDocument();
  });
});
