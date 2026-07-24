import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsAuthError, cmsStepUpCoordinator } from "../../features/cms-auth";
import ReauthenticationDialog from "./ReauthenticationDialog";

const authMock = vi.hoisted(() => ({
  reauthenticate: vi.fn()
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => ({
    reauthenticate: authMock.reauthenticate
  })
}));

describe("ReauthenticationDialog", () => {
  beforeEach(() => {
    authMock.reauthenticate.mockReset();
  });

  afterEach(() => {
    cmsStepUpCoordinator.resetForTests();
  });

  it("keeps the shared MFA dialog open after a rejected proof and completes after a valid retry", async () => {
    authMock.reauthenticate
      .mockRejectedValueOnce(new CmsAuthError(401, { message: "หลักฐานยืนยันไม่ถูกต้อง" }))
      .mockResolvedValueOnce({
        recentPasswordAuthentication: true,
        recentMfaAuthentication: true
      });
    const pendingRequest = cmsStepUpCoordinator.request("mfa");
    void pendingRequest.catch(() => undefined);
    render(<ReauthenticationDialog />);

    fireEvent.change(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), {
      target: { value: " exact password " }
    });
    fireEvent.change(screen.getByLabelText(/รหัส 6 หลัก/), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

    expect(await screen.findByText("หลักฐานยืนยันไม่ถูกต้อง")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(authMock.reauthenticate).toHaveBeenLastCalledWith({
      currentPassword: " exact password ",
      totpCode: "123456"
    });

    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));
    await expect(pendingRequest).resolves.toBeUndefined();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
