import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("submits password assurance without empty MFA proof fields", async () => {
    authMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: false
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    fireEvent.change(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), {
      target: { value: " exact password " }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

    await expect(pendingRequest).resolves.toBeUndefined();
    expect(authMock.reauthenticate).toHaveBeenCalledWith({
      currentPassword: " exact password "
    });
  });

  it("submits optional TOTP proof with password assurance", async () => {
    authMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: true
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    fireEvent.change(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), {
      target: { value: "root password" }
    });
    fireEvent.change(screen.getByLabelText("รหัส 6 หลัก"), {
      target: { value: "123456" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

    await expect(pendingRequest).resolves.toBeUndefined();
    expect(authMock.reauthenticate).toHaveBeenCalledWith({
      currentPassword: "root password",
      totpCode: "123456"
    });
  });

  it("submits an exact optional Recovery Code with password assurance", async () => {
    authMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: true
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    fireEvent.change(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), {
      target: { value: "root password" }
    });
    fireEvent.click(screen.getByRole("radio", { name: "รหัสกู้คืน" }));
    fireEvent.change(screen.getByRole("textbox", { name: "รหัสกู้คืน" }), {
      target: { value: " Recovery-Code Exact " }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

    await expect(pendingRequest).resolves.toBeUndefined();
    expect(authMock.reauthenticate).toHaveBeenCalledWith({
      currentPassword: "root password",
      recoveryCode: " Recovery-Code Exact "
    });
  });

  it("requires an MFA factor for MFA assurance", () => {
    const pendingRequest = cmsStepUpCoordinator.request("mfa");
    void pendingRequest.catch(() => undefined);
    render(<ReauthenticationDialog />);

    fireEvent.change(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), {
      target: { value: "password" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

    expect(screen.getByText("กรุณากรอกข้อมูลยืนยันตัวตนให้ครบถ้วน")).toBeInTheDocument();
    expect(authMock.reauthenticate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("rejects an incomplete optional TOTP locally", () => {
    const pendingRequest = cmsStepUpCoordinator.request("password");
    void pendingRequest.catch(() => undefined);
    render(<ReauthenticationDialog />);

    fireEvent.change(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), {
      target: { value: "password" }
    });
    fireEvent.change(screen.getByLabelText("รหัส 6 หลัก"), {
      target: { value: "12345" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

    expect(screen.getByText("รหัสจากแอปต้องเป็นตัวเลข 6 หลัก")).toBeInTheDocument();
    expect(authMock.reauthenticate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("lets an MFA-enabled Root account complete password step-up with its TOTP", async () => {
    authMock.reauthenticate.mockResolvedValue({
      recentPasswordAuthentication: true,
      recentMfaAuthentication: true
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    expect(screen.getByText("บัญชีที่เปิดใช้ MFA ต้องกรอกรหัสจากแอปหรือรหัสกู้คืนด้วย")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), {
      target: { value: "root password" }
    });
    fireEvent.change(screen.getByLabelText("รหัส 6 หลัก"), {
      target: { value: "654321" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

    await expect(pendingRequest).resolves.toBeUndefined();
    expect(authMock.reauthenticate).toHaveBeenCalledWith({
      currentPassword: "root password",
      totpCode: "654321"
    });
  });

  it("closes and rejects the pending request when Session refresh fails after reauthentication", async () => {
    const refreshFailure = new CmsAuthError(503);
    authMock.reauthenticate.mockImplementation(async () => {
      cmsStepUpCoordinator.fail(refreshFailure);
      throw refreshFailure;
    });
    const pendingRequest = cmsStepUpCoordinator.request("password");
    render(<ReauthenticationDialog />);

    fireEvent.change(screen.getByLabelText(/รหัสผ่านปัจจุบัน/), {
      target: { value: "temporary password" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

    await expect(pendingRequest).rejects.toBe(refreshFailure);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    let retryRequest!: Promise<void>;
    act(() => {
      retryRequest = cmsStepUpCoordinator.request("password");
    });
    void retryRequest.catch(() => undefined);
    expect(await screen.findByLabelText(/รหัสผ่านปัจจุบัน/)).toHaveValue("");
    expect(screen.getByLabelText("รหัส 6 หลัก")).toHaveValue("");
  });
});
