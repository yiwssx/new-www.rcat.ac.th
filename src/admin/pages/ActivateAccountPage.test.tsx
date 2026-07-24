import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivateAccountPage from "./ActivateAccountPage";

const lifecycleMock = vi.hoisted(() => ({
  inspect: vi.fn(),
  accept: vi.fn()
}));

vi.mock("../../features/cms-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/cms-auth")>();
  return {
    ...actual,
    inspectCmsInvitation: lifecycleMock.inspect,
    acceptCmsInvitation: lifecycleMock.accept
  };
});

describe("ActivateAccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/activate-account");
    lifecycleMock.inspect.mockResolvedValue({
      valid: true,
      user: {
        email: "invited@example.test",
        name: "Invited User",
        role: "viewer",
        username: null
      },
      expiresAt: "2026-07-26T00:00:00.000Z"
    });
    lifecycleMock.accept.mockResolvedValue(undefined);
  });

  it("keeps the invitation token out of the URL and clears it after acceptance", async () => {
    render(<ActivateAccountPage />);
    const token = "INVITATION-TOKEN-NEVER-IN-URL";
    fireEvent.change(screen.getByLabelText(/โทเค็นเชิญ/), { target: { value: token } });
    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบโทเค็น" }));

    expect(await screen.findByText("อีเมล: invited@example.test")).toBeInTheDocument();
    expect(window.location.href).not.toContain(token);
    fireEvent.change(screen.getByLabelText(/^รหัสผ่านใหม่/), { target: { value: "new password" } });
    fireEvent.change(screen.getByLabelText(/ยืนยันรหัสผ่านใหม่/), { target: { value: "new password" } });
    fireEvent.click(screen.getByRole("button", { name: "เปิดใช้งานบัญชี" }));

    await waitFor(() => expect(lifecycleMock.accept).toHaveBeenCalledWith(expect.objectContaining({ token })));
    expect(window.location.pathname).toBe("/activate-account");
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
  });
});
