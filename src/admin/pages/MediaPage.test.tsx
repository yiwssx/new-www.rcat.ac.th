import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CmsSnapshot, MediaAsset, Session, User } from "../../types";
import MediaPage, { MediaAssetCard } from "./MediaPage";

const authMock = vi.hoisted(() => ({
  role: "editor" as User["role"]
}));

const dashboardMock = vi.hoisted(() => ({
  getAdminCmsSnapshot: vi.fn()
}));

const mediaMock = vi.hoisted(() => ({
  saveMediaAsset: vi.fn(),
  deleteMediaAsset: vi.fn()
}));

const publicInvalidationMock = vi.hoisted(() => ({
  invalidatePublicCmsData: vi.fn()
}));

const swalMock = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn()
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => {
    const user: User = {
      id: `cloudflare-${authMock.role}`,
      name: `Cloudflare ${authMock.role}`,
      email: `${authMock.role}@example.invalid`,
      role: authMock.role
    };
    const session: Session = {
      user,
      token: "test-session-token",
      expiresAt: "2026-06-23T00:00:00.000Z"
    };

    return {
      session,
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

vi.mock("../../features/cms-dashboard", () => ({
  getAdminCmsSnapshot: dashboardMock.getAdminCmsSnapshot
}));

vi.mock("../../features/cms-media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-media")>()),
  saveMediaAsset: mediaMock.saveMediaAsset,
  deleteMediaAsset: mediaMock.deleteMediaAsset
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidatePublicCmsData: publicInvalidationMock.invalidatePublicCmsData
}));

vi.mock("../../utils/swal", () => ({
  appSwal: swalMock
}));

const asset: MediaAsset = {
  id: "media-original-1",
  name: "original-photo.jpg",
  type: "image",
  size: "4.8 MB",
  owner: "editor",
  driveUrl: "https://drive.google.com/file/d/original-file/view",
  fileId: "original-file",
  mimeType: "image/jpeg",
  thumbnailUrl: "https://drive.google.com/thumbnail?id=original-file&sz=w1200",
  previewUrl: "https://drive.google.com/file/d/original-file/preview",
  embedUrl: "https://drive.google.com/file/d/original-file/preview",
  updatedAt: "2026-06-21T10:00:00+07:00"
};

const secondAsset: MediaAsset = {
  ...asset,
  id: "media-second-1",
  name: "second-photo.jpg",
  driveUrl: "https://drive.google.com/file/d/second-file/view",
  fileId: "second-file",
  thumbnailUrl: "https://drive.google.com/thumbnail?id=second-file&sz=w1200",
  previewUrl: "https://drive.google.com/file/d/second-file/preview",
  embedUrl: "https://drive.google.com/file/d/second-file/preview"
};

function snapshot(media: MediaAsset[] = [asset]): CmsSnapshot {
  return {
    metrics: [],
    content: [],
    documents: [],
    media,
    events: [],
    menu: [],
    carouselSlides: [],
    externalServices: []
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function renderMediaPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MediaPage />
    </QueryClientProvider>
  );
}

async function openUploadConfirmation() {
  renderMediaPage();

  await screen.findByText(asset.name);
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มสื่อ" }));
  await screen.findByRole("button", { name: "เลือกไฟล์" });

  const fileInput = document.body.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).not.toBeNull();
  fireEvent.change(fileInput as HTMLInputElement, {
    target: {
      files: [new File(["image-content"], "campus-photo.jpg", { type: "image/jpeg" })]
    }
  });

  fireEvent.change(screen.getByRole("textbox", { name: /ผู้รับผิดชอบ/ }), {
    target: { value: "งานประชาสัมพันธ์" }
  });
  fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));

  expect(screen.getByRole("heading", { name: "อัปโหลดสื่อ?" })).toBeInTheDocument();
}

describe("MediaAssetCard", () => {
  it("uses display-only preview metadata while keeping the original Drive link and size", () => {
    const { rerender } = render(<MediaAssetCard asset={asset} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("img", { name: asset.name })).toHaveAttribute("src", asset.thumbnailUrl);
    expect(screen.getByRole("link", { name: "เปิดสื่อ" })).toHaveAttribute("href", asset.driveUrl);
    expect(screen.getByText(asset.size)).toBeInTheDocument();

    fireEvent.error(screen.getByRole("img", { name: asset.name }));

    expect(screen.queryByRole("img", { name: asset.name })).not.toBeInTheDocument();
    expect(screen.getByText("ไม่สามารถแสดงตัวอย่างได้")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "เปิดสื่อ" })).toHaveAttribute("href", asset.driveUrl);

    rerender(<MediaAssetCard asset={{ ...asset, thumbnailUrl: undefined }} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("img", { name: asset.name })).toHaveAttribute("src", asset.previewUrl);
  });
});

describe("MediaPage media mutation feedback", () => {
  beforeEach(() => {
    authMock.role = "editor";
    dashboardMock.getAdminCmsSnapshot.mockReset();
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot());
    mediaMock.saveMediaAsset.mockReset();
    mediaMock.saveMediaAsset.mockResolvedValue(asset);
    mediaMock.deleteMediaAsset.mockReset();
    mediaMock.deleteMediaAsset.mockResolvedValue({ id: asset.id, deleted: true });
    publicInvalidationMock.invalidatePublicCmsData.mockReset();
    publicInvalidationMock.invalidatePublicCmsData.mockResolvedValue(undefined);
    swalMock.fire.mockReset();
    swalMock.fire.mockResolvedValue({ isConfirmed: true });
    swalMock.close.mockReset();
    swalMock.close.mockResolvedValue(undefined);
    swalMock.showLoading.mockReset();
  });

  it("shows clear upload pending feedback while the upload is in progress", async () => {
    const upload = deferred<MediaAsset>();
    mediaMock.saveMediaAsset.mockReturnValue(upload.promise);
    await openUploadConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "อัปโหลด" }));

    await waitFor(() => expect(mediaMock.saveMediaAsset).toHaveBeenCalledTimes(1));
    expect(screen.getByText("กำลังอัปโหลดไฟล์ไปยัง Drive และบันทึกข้อมูล")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "กำลังบันทึก" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "กลับ" })).toBeDisabled();
    expect(swalMock.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "กำลังอัปโหลดสื่อ",
        text: "กรุณารอสักครู่ อย่าปิดหน้านี้",
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );
  });

  it("shows a clear upload success toast after upload finishes", async () => {
    await openUploadConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "อัปโหลด" }));

    await waitFor(() =>
      expect(swalMock.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          toast: true,
          icon: "success",
          title: "อัปโหลดสื่อสำเร็จ",
          timer: 2000
        })
      )
    );
    expect(swalMock.close).toHaveBeenCalled();
  });

  it("keeps the upload dialog open and shows an error modal when upload fails", async () => {
    mediaMock.saveMediaAsset.mockRejectedValue(new Error("Apps Script bridge unavailable"));
    await openUploadConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "อัปโหลด" }));

    expect(await screen.findByText("Apps Script bridge unavailable")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "อัปโหลดสื่อ?" })).toBeInTheDocument();
    expect(swalMock.close).toHaveBeenCalled();
    expect(swalMock.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "error",
        title: "ไม่สามารถอัปโหลดสื่อได้",
        text: "Apps Script bridge unavailable"
      })
    );
  });

  it("disables media delete actions and marks the current asset while delete is pending", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot([asset, secondAsset]));
    const deletion = deferred<{ id: string; deleted: boolean }>();
    mediaMock.deleteMediaAsset.mockReturnValue(deletion.promise);
    renderMediaPage();

    await screen.findByText(asset.name);
    fireEvent.click(screen.getAllByRole("button", { name: "ลบสื่อ" })[0]);

    await waitFor(() => expect(mediaMock.deleteMediaAsset).toHaveBeenCalledWith(asset.id, expect.anything()));
    expect(screen.getByText("กำลังลบ")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "ลบสื่อ" })) {
      expect(button).toBeDisabled();
    }

    deletion.resolve({ id: asset.id, deleted: true });
  });

  it("shows a clear delete success toast after delete finishes", async () => {
    renderMediaPage();

    await screen.findByText(asset.name);
    fireEvent.click(screen.getByRole("button", { name: "ลบสื่อ" }));

    await waitFor(() =>
      expect(swalMock.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          toast: true,
          icon: "success",
          title: "ลบสื่อสำเร็จ",
          timer: 2000
        })
      )
    );
    expect(swalMock.close).toHaveBeenCalled();
  });

  it("renders read-only users without controls that can start media mutations", async () => {
    authMock.role = "viewer";
    renderMediaPage();

    await screen.findByText(asset.name);

    expect(screen.queryByRole("button", { name: "เพิ่มสื่อ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไขสื่อ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบสื่อ" })).not.toBeInTheDocument();
    expect(mediaMock.saveMediaAsset).not.toHaveBeenCalled();
    expect(mediaMock.deleteMediaAsset).not.toHaveBeenCalled();
  });
});
