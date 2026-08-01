import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BackupPage from "./BackupPage";
import type { AdminBackupCounts, AdminBackupDownload } from "../../features/admin-write/cloudflareApi";
import type { User } from "../../types";

const authMock = vi.hoisted(() => ({
  role: "admin" as User["role"],
  capabilities: ["backup.counts", "backup.download"]
}));

const cloudflareApiMock = vi.hoisted(() => ({
  getD1BackupCountsFromCloudflare: vi.fn(),
  downloadD1BackupFromCloudflare: vi.fn()
}));

const swalInstance = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn()
}));

vi.mock("sweetalert2", () => ({
  default: {
    mixin: vi.fn(() => swalInstance)
  }
}));

vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

vi.mock("../../features/admin-write/cloudflareApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-write/cloudflareApi")>()),
  getD1BackupCountsFromCloudflare: cloudflareApiMock.getD1BackupCountsFromCloudflare,
  downloadD1BackupFromCloudflare: cloudflareApiMock.downloadD1BackupFromCloudflare
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => {
    const user: User = {
      id: `cloudflare-${authMock.role}`,
      name: `Cloudflare ${authMock.role}`,
      email: `${authMock.role}@example.invalid`,
      role: authMock.role
    };
    const session = { user, capabilities: authMock.capabilities };

    return {
      session,
      capabilities: authMock.capabilities,
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

function backupCounts(overrides: Partial<AdminBackupCounts> = {}): AdminBackupCounts {
  return {
    generatedAt: "2026-07-08T05:00:00.000Z",
    environment: "preview",
    tables: [
      {
        name: "contents",
        rowCount: 2,
        status: "ok"
      },
      {
        name: "media_assets",
        rowCount: 0,
        status: "missing",
        message: "table is not present in this environment"
      }
    ],
    counts: {
      contents: 2,
      media_assets: 0
    },
    warnings: ["media_assets: table is not present in this environment"],
    ...overrides
  };
}

function backupDownload(): AdminBackupDownload {
  return {
    filename: "rcat-d1-backup-preview-2026-07-08T05-00-00-000Z.json",
    blob: new Blob([JSON.stringify({ schemaVersion: 1, counts: { contents: 2 } })], {
      type: "application/json"
    })
  };
}

function findSwalCall(predicate: (options: Record<string, unknown>) => boolean) {
  const call = swalInstance.fire.mock.calls.find(([options]) => {
    if (!options || typeof options !== "object") {
      return false;
    }

    return predicate(options as Record<string, unknown>);
  });

  return call?.[0] as Record<string, unknown> | undefined;
}

describe("BackupPage", () => {
  beforeEach(() => {
    authMock.role = "admin";
    authMock.capabilities = ["backup.counts", "backup.download"];
    cloudflareApiMock.getD1BackupCountsFromCloudflare.mockReset();
    cloudflareApiMock.downloadD1BackupFromCloudflare.mockReset();
    cloudflareApiMock.getD1BackupCountsFromCloudflare.mockResolvedValue(backupCounts());
    cloudflareApiMock.downloadD1BackupFromCloudflare.mockResolvedValue(backupDownload());
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);
    swalInstance.showLoading.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:rcat-backup")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("renders the admin backup route surface for admin users", () => {
    render(<BackupPage />);

    expect(screen.getByRole("heading", { level: 1, name: "สำรองข้อมูลระบบ" })).toBeInTheDocument();
    expect(screen.getByText(/ไฟล์สำรองข้อมูลอาจมีข้อมูลระบบและข้อมูลผู้ดูแล/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ตรวจนับข้อมูล" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "ดาวน์โหลดไฟล์สำรองข้อมูล" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /กู้คืน/ })).not.toBeInTheDocument();
  });

  it("disables backup actions for read-only or non-admin users", () => {
    authMock.role = "viewer";
    authMock.capabilities = [];

    render(<BackupPage />);

    expect(screen.getByText(/บัญชีนี้ไม่มีสิทธิ์ตรวจนับหรือดาวน์โหลดไฟล์สำรองข้อมูลระบบ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ตรวจนับข้อมูล" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ดาวน์โหลดไฟล์สำรองข้อมูล" })).toBeDisabled();
  });

  it("keeps backup counts and download controls independently capability-gated", () => {
    authMock.capabilities = ["backup.counts"];

    render(<BackupPage />);

    expect(screen.getByRole("button", { name: "ตรวจนับข้อมูล" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "ดาวน์โหลดไฟล์สำรองข้อมูล" })).toBeDisabled();
  });

  it("checks table counts and renders row status details", async () => {
    render(<BackupPage />);

    fireEvent.click(screen.getByRole("button", { name: "ตรวจนับข้อมูล" }));

    await waitFor(() => expect(cloudflareApiMock.getD1BackupCountsFromCloudflare).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("contents")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("media_assets")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText("ตรวจนับล่าสุด: 8 กรกฎาคม 2569 12:00")).toBeInTheDocument();
  });

  it("confirms, downloads, and shows an acknowledged success modal", async () => {
    render(<BackupPage />);

    fireEvent.click(screen.getByRole("button", { name: "ดาวน์โหลดไฟล์สำรองข้อมูล" }));

    await waitFor(() => expect(cloudflareApiMock.downloadD1BackupFromCloudflare).toHaveBeenCalledTimes(1));
    expect(findSwalCall((options) => options.title === "ต้องการสร้างและดาวน์โหลดไฟล์สำรองข้อมูลระบบหรือไม่")).toEqual(
      expect.objectContaining({
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "ดาวน์โหลด"
      })
    );
    expect(findSwalCall((options) => options.title === "กำลังสร้างไฟล์สำรองข้อมูล")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(findSwalCall((options) => options.title === "ดาวน์โหลดไฟล์สำรองข้อมูลสำเร็จ")).toEqual(
      expect.objectContaining({
        icon: "success",
        confirmButtonText: "ตกลง"
      })
    );
  });

  it("shows an acknowledged error modal when backup generation fails", async () => {
    cloudflareApiMock.downloadD1BackupFromCloudflare.mockRejectedValue(new Error("backup failed"));

    render(<BackupPage />);
    fireEvent.click(screen.getByRole("button", { name: "ดาวน์โหลดไฟล์สำรองข้อมูล" }));

    await waitFor(() => expect(cloudflareApiMock.downloadD1BackupFromCloudflare).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("backup failed")).toBeInTheDocument();
    expect(findSwalCall((options) => options.title === "ไม่สามารถสร้างไฟล์สำรองข้อมูลได้")).toEqual(
      expect.objectContaining({
        icon: "error",
        text: "backup failed",
        confirmButtonText: "ตกลง"
      })
    );
  });
});
