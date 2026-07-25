import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecoveryCodeHandoff, type RecoveryCodeHandoffMode } from "../../context/RecoveryCodeHandoffContext";
import { RecoveryCodeHandoffProvider } from "../../context/RecoveryCodeHandoffProvider";
import RecoveryCodeNavigationGuard from "./RecoveryCodeNavigationGuard";

const routerMock = vi.hoisted(() => ({
  navigate: vi.fn(),
  blocker: null as { shouldBlockFn: () => boolean; enableBeforeUnload?: boolean } | null
}));
const authMock = vi.hoisted(() => ({
  clearSession: vi.fn(),
  refreshSession: vi.fn()
}));
const sessionEventMock = vi.hoisted(() => ({
  broadcast: vi.fn()
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routerMock.navigate,
  useBlocker: (options: { shouldBlockFn: () => boolean; enableBeforeUnload?: boolean }) => {
    routerMock.blocker = options;
  }
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => authMock
}));

vi.mock("../../features/cms-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-auth")>()),
  broadcastCmsSessionEvent: sessionEventMock.broadcast
}));

const codes = Array.from({ length: 10 }, (_, index) => `HANDOFF-${index}`);

function HandoffStarter() {
  const { beginRecoveryCodeHandoff } = useRecoveryCodeHandoff();

  function begin(mode: RecoveryCodeHandoffMode) {
    beginRecoveryCodeHandoff({ codes, mode });
  }

  return (
    <>
      <button onClick={() => begin("voluntary")}>start voluntary</button>
      <button onClick={() => begin("mandatory")}>start mandatory</button>
      <button onClick={() => begin("regenerated")}>start regenerated</button>
    </>
  );
}

function renderHandoff() {
  return render(
    <RecoveryCodeHandoffProvider>
      <HandoffStarter />
      <RecoveryCodeNavigationGuard />
    </RecoveryCodeHandoffProvider>
  );
}

async function acknowledge() {
  fireEvent.click(screen.getByRole("checkbox", { name: /ฉันได้เก็บรหัสกู้คืนไว้แล้ว/ }));
  fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("application Recovery Code handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMock.blocker = null;
    routerMock.navigate.mockResolvedValue(undefined);
    authMock.refreshSession.mockResolvedValue({
      user: { id: "user-1" },
      capabilities: ["dashboard.read"]
    });
  });

  it("shows all ten codes and blocks route changes, Escape, backdrop dismissal, and unload", async () => {
    const view = renderHandoff();
    fireEvent.click(screen.getByRole("button", { name: "start regenerated" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText(/HANDOFF-/)).toHaveLength(10);
    expect(screen.getByRole("button", { name: "คัดลอกทั้งหมด" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ดาวน์โหลดไฟล์ข้อความ" })).toBeInTheDocument();
    expect(routerMock.blocker?.enableBeforeUnload).toBe(false);
    expect(routerMock.blocker?.shouldBlockFn()).toBe(true);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const backdrop = view.container.ownerDocument.querySelector(".MuiBackdrop-root");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await acknowledge();
    expect(routerMock.blocker?.shouldBlockFn()).toBe(false);
    const afterAcknowledge = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterAcknowledge);
    expect(afterAcknowledge.defaultPrevented).toBe(false);
  });

  it("ends a voluntary handoff at Login with local Session state cleared and logged out", async () => {
    renderHandoff();
    fireEvent.click(screen.getByRole("button", { name: "start voluntary" }));
    await screen.findByText("HANDOFF-0");

    await acknowledge();

    expect(authMock.clearSession).toHaveBeenCalledWith({ broadcast: true });
    expect(routerMock.navigate).toHaveBeenCalledWith({ to: "/login", replace: true });
    expect(authMock.refreshSession).not.toHaveBeenCalled();
  });

  it("refreshes the mandatory-enrollment Session and broadcasts only session-changed", async () => {
    renderHandoff();
    fireEvent.click(screen.getByRole("button", { name: "start mandatory" }));
    await screen.findByText("HANDOFF-0");

    await acknowledge();

    expect(authMock.refreshSession).toHaveBeenCalledTimes(1);
    expect(sessionEventMock.broadcast).toHaveBeenCalledWith("session-changed");
    expect(sessionEventMock.broadcast).toHaveBeenCalledTimes(1);
    expect(routerMock.navigate).toHaveBeenCalledWith({ to: "/admin", replace: true });
  });
});
