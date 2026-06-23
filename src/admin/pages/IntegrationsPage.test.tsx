import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkMediaBridgeStatus } from "../../features/cms-media/mediaBridgeClient";
import IntegrationsPage from "./IntegrationsPage";

vi.mock("../../config/adminWriteProvider", () => ({
  getAdminWriteProvider: () => "cloudflare"
}));

vi.mock("../../features/cms-media/mediaBridgeClient", () => ({
  checkMediaBridgeStatus: vi.fn()
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
  });

  it("shows Cloudflare and Vercel proxy architecture without requiring a browser Apps Script URL", async () => {
    checkMediaBridgeStatusMock.mockResolvedValue({
      mode: "server-proxy",
      configured: true,
      appsScriptUrlConfigured: true,
      bridgeTokenConfigured: true
    });

    renderPage();

    expect(await screen.findByText("Cloudflare structured data")).toBeInTheDocument();
    expect(screen.getAllByText(/เชื่อมต่อผ่าน Vercel Apps Script Proxy/).length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent("VITE_GOOGLE_APPS_SCRIPT_URL");
  });

  it("warns when the server-side media bridge URL or token is missing", async () => {
    checkMediaBridgeStatusMock.mockResolvedValue({
      mode: "server-proxy",
      configured: false,
      appsScriptUrlConfigured: false,
      bridgeTokenConfigured: false
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("สะพานสื่อยังไม่พร้อม"));
    expect(screen.getByRole("alert")).toHaveTextContent("appsScriptUrlConfigured");
    expect(screen.getByRole("alert")).toHaveTextContent("bridgeTokenConfigured");
  });

  it("shows a sign-in-again message when media bridge status is forbidden by session state", async () => {
    checkMediaBridgeStatusMock.mockRejectedValue(new Error("admin proxy session is required"));

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("กรุณาเข้าสู่ระบบใหม่เพื่อตรวจสอบสถานะสะพานสื่อ")
    );
  });
});
