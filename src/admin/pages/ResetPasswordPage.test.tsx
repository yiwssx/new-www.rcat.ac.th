import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "./ResetPasswordPage";

const recoveryMock = vi.hoisted(() => ({
  inspect: vi.fn(),
  complete: vi.fn()
}));

vi.mock("../../features/cms-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/cms-auth")>();
  return {
    ...actual,
    inspectCmsPasswordReset: recoveryMock.inspect,
    completeCmsPasswordReset: recoveryMock.complete
  };
});

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/reset-password");
    recoveryMock.inspect.mockResolvedValue({
      valid: true,
      user: { emailHint: "u***@example.test" },
      expiresAt: "2026-07-26T00:00:00.000Z"
    });
    recoveryMock.complete.mockResolvedValue(undefined);
  });

  it("keeps the reset token out of the URL and never implements email lookup", async () => {
    render(<ResetPasswordPage />);
    const token = "RESET-TOKEN-NEVER-IN-URL";
    fireEvent.change(screen.getByLabelText(/โทเค็นตั้งรหัสผ่านใหม่/), { target: { value: token } });
    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบโทเค็น" }));

    expect(await screen.findByText(/u\*\*\*@example\.test/)).toBeInTheDocument();
    expect(window.location.href).not.toContain(token);
    expect(screen.queryByLabelText(/อีเมล/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^รหัสผ่านใหม่/), { target: { value: "new password" } });
    fireEvent.change(screen.getByLabelText(/ยืนยันรหัสผ่านใหม่/), { target: { value: "new password" } });
    fireEvent.click(screen.getByRole("button", { name: "ตั้งรหัสผ่านใหม่" }));

    await waitFor(() => expect(recoveryMock.complete).toHaveBeenCalledWith(token, "new password", "new password"));
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
  });
});
