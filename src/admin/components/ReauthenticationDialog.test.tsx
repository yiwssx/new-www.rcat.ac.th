import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    cleanup();
    cmsStepUpCoordinator.resetForTests();
  });

  it("submits password assurance without empty MFA proof fields", async () => {
    const user = userEvent.setup();
    authMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: false
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    await user.type(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), " exact password ");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(pendingRequest).resolves.toBeUndefined();
    expect(authMock.reauthenticate).toHaveBeenCalledWith({
      currentPassword: " exact password "
    });
  });

  it("submits optional TOTP proof with password assurance", async () => {
    const user = userEvent.setup();
    authMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: true
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    await user.type(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), "root password");
    await user.type(screen.getByLabelText("รหัส 6 หลัก"), "123456");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(pendingRequest).resolves.toBeUndefined();
    expect(authMock.reauthenticate).toHaveBeenCalledWith({
      currentPassword: "root password",
      totpCode: "123456"
    });
  });

  it("submits an exact optional Recovery Code with password assurance", async () => {
    const user = userEvent.setup();
    authMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: true
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    await user.type(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), "root password");
    await user.click(screen.getByRole("radio", { name: "รหัสกู้คืน" }));
    await user.type(screen.getByRole("textbox", { name: "รหัสกู้คืน" }), " Recovery-Code Exact ");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(pendingRequest).resolves.toBeUndefined();
    expect(authMock.reauthenticate).toHaveBeenCalledWith({
      currentPassword: "root password",
      recoveryCode: " Recovery-Code Exact "
    });
  });

  it("requires an MFA factor for MFA assurance", async () => {
    const user = userEvent.setup();
    const pendingRequest = cmsStepUpCoordinator.request("mfa");
    void pendingRequest.catch(() => undefined);
    render(<ReauthenticationDialog />);

    await user.type(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), "password");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));

    expect(await screen.findByText("กรุณากรอกข้อมูลยืนยันตัวตนให้ครบถ้วน")).toBeInTheDocument();
    expect(authMock.reauthenticate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("rejects an incomplete optional TOTP locally", async () => {
    const user = userEvent.setup();
    const pendingRequest = cmsStepUpCoordinator.request("password");
    void pendingRequest.catch(() => undefined);
    render(<ReauthenticationDialog />);

    await user.type(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), "password");
    await user.type(screen.getByLabelText("รหัส 6 หลัก"), "12345");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));

    expect(await screen.findByText("รหัสจากแอปต้องเป็นตัวเลข 6 หลัก")).toBeInTheDocument();
    expect(authMock.reauthenticate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the shared MFA dialog open after a rejected proof and completes after a valid retry", async () => {
    const user = userEvent.setup();
    authMock.reauthenticate
      .mockRejectedValueOnce(new CmsAuthError(401, { message: "หลักฐานยืนยันไม่ถูกต้อง" }))
      .mockResolvedValueOnce({
        recentPasswordAuthentication: true,
        recentMfaAuthentication: true
      });
    const pendingRequest = cmsStepUpCoordinator.request("mfa");
    void pendingRequest.catch(() => undefined);
    render(<ReauthenticationDialog />);

    await user.type(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), " exact password ");
    await user.type(screen.getByLabelText(/รหัส 6 หลัก/), "123456");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));

    expect(await screen.findByText("หลักฐานยืนยันไม่ถูกต้อง")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(authMock.reauthenticate).toHaveBeenLastCalledWith({
      currentPassword: " exact password ",
      totpCode: "123456"
    });

    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(pendingRequest).resolves.toBeUndefined();
  });

  it("lets an MFA-enabled Root account complete password step-up with its TOTP", async () => {
    const user = userEvent.setup();
    authMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: true
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    expect(screen.getByText("บัญชีที่เปิดใช้ MFA ต้องกรอกรหัสจากแอปหรือรหัสกู้คืนด้วย")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), "root password");
    await user.type(screen.getByLabelText("รหัส 6 หลัก"), "654321");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(pendingRequest).resolves.toBeUndefined();
    expect(authMock.reauthenticate).toHaveBeenCalledWith({
      currentPassword: "root password",
      totpCode: "654321"
    });
  });

  it("closes and rejects the pending request when Session refresh fails after reauthentication", async () => {
    const user = userEvent.setup();
    const refreshFailure = new CmsAuthError(503);
    authMock.reauthenticate.mockImplementation(async () => {
      cmsStepUpCoordinator.fail(refreshFailure);
      throw refreshFailure;
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    const pendingRejection = expect(pendingRequest).rejects.toBe(refreshFailure);
    render(<ReauthenticationDialog />);

    await user.type(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), "temporary password");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await pendingRejection;

    let retryRequest!: Promise<void>;
    act(() => {
      retryRequest = cmsStepUpCoordinator.request("password");
    });
    void retryRequest.catch(() => undefined);
    expect(await screen.findByLabelText(/รหัสผ่านปัจจุบัน/)).toHaveValue("");
    expect(screen.getByLabelText("รหัส 6 หลัก")).toHaveValue("");
  });
});
