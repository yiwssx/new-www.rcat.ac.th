import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CmsDocumentItem, CmsSnapshot, Session, User } from "../../types";
import DocumentsPage from "./DocumentsPage";

const authMock = vi.hoisted(() => ({
  role: "editor" as User["role"]
}));

const dashboardMock = vi.hoisted(() => ({
  getAdminCmsSnapshot: vi.fn()
}));

const documentsMock = vi.hoisted(() => ({
  saveDocumentToApi: vi.fn(),
  deleteDocumentFromApi: vi.fn()
}));

const publicInvalidationMock = vi.hoisted(() => ({
  invalidatePublicCmsData: vi.fn()
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

vi.mock("../../features/cms-documents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-documents")>()),
  saveDocumentToApi: documentsMock.saveDocumentToApi,
  deleteDocumentFromApi: documentsMock.deleteDocumentFromApi
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidatePublicCmsData: publicInvalidationMock.invalidatePublicCmsData
}));

const documentItem: CmsDocumentItem = {
  id: "document-1",
  title: "คู่มือนักศึกษา",
  description: "เอกสารคู่มือนักศึกษา",
  category: "คู่มือ",
  fileUrl: "https://example.invalid/document.pdf",
  fileName: "student-guide.pdf",
  mediaId: "",
  publishedAt: "2026-06-24T00:00:00.000Z",
  status: "published",
  order: 1,
  pinned: false,
  updatedAt: "2026-06-24T00:00:00.000Z",
  revision: 1
};

function snapshot(documents: CmsDocumentItem[] = [documentItem]): CmsSnapshot {
  return {
    metrics: [],
    content: [],
    documents,
    media: [],
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

function renderDocumentsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentsPage />
    </QueryClientProvider>
  );
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

function expectAcknowledgedResultModal(options: Record<string, unknown> | undefined, title: string) {
  expect(options).toEqual(
    expect.objectContaining({
      icon: "success",
      title,
      confirmButtonText: "ตกลง"
    })
  );
  expect(options).not.toHaveProperty("toast");
  expect(options).not.toHaveProperty("timer");
}

describe("DocumentsPage operation feedback", () => {
  beforeEach(() => {
    authMock.role = "editor";
    dashboardMock.getAdminCmsSnapshot.mockReset();
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot());
    documentsMock.saveDocumentToApi.mockReset();
    documentsMock.saveDocumentToApi.mockResolvedValue(documentItem);
    documentsMock.deleteDocumentFromApi.mockReset();
    documentsMock.deleteDocumentFromApi.mockResolvedValue({ id: documentItem.id, deleted: true });
    publicInvalidationMock.invalidatePublicCmsData.mockReset();
    publicInvalidationMock.invalidatePublicCmsData.mockResolvedValue(undefined);
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);
    swalInstance.showLoading.mockReset();
  });

  it("shows loading and an acknowledged success modal when saving a document", async () => {
    const save = deferred<CmsDocumentItem>();
    documentsMock.saveDocumentToApi.mockReturnValue(save.promise);
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มเอกสาร" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อเอกสาร" }), {
      target: { value: "ประกาศผลการเรียน" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "ลิงก์ไฟล์" }), {
      target: { value: "https://example.invalid/grades.pdf" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => expect(documentsMock.saveDocumentToApi).toHaveBeenCalledTimes(1));
    expect(findSwalCall((options) => options.title === "กำลังบันทึกเอกสาร")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );

    save.resolve(documentItem);

    let successModal: Record<string, unknown> | undefined;
    await waitFor(() => {
      successModal = findSwalCall((options) => options.title === "บันทึกเอกสารสำเร็จ");
      expectAcknowledgedResultModal(successModal, "บันทึกเอกสารสำเร็จ");
    });
  }, 10_000);

  it("keeps the dialog error and shows an acknowledged error modal when saving fails", async () => {
    documentsMock.saveDocumentToApi.mockRejectedValue(new Error("D1 unavailable"));
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มเอกสาร" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ชื่อเอกสาร" }), {
      target: { value: "ประกาศผลการเรียน" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "ลิงก์ไฟล์" }), {
      target: { value: "https://example.invalid/grades.pdf" }
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(await screen.findByText("D1 unavailable")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "เพิ่มเอกสารเผยแพร่" })).toBeInTheDocument();
    expect(findSwalCall((options) => options.title === "ไม่สามารถบันทึกเอกสารได้")).toEqual(
      expect.objectContaining({
        icon: "error",
        title: "ไม่สามารถบันทึกเอกสารได้",
        text: "D1 unavailable",
        confirmButtonText: "ตกลง"
      })
    );
  });

  it("shows loading and an acknowledged success modal when deleting a document", async () => {
    const deletion = deferred<{ id: string; deleted: boolean }>();
    documentsMock.deleteDocumentFromApi.mockReturnValue(deletion.promise);
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "ลบ" }));

    await waitFor(() =>
      expect(documentsMock.deleteDocumentFromApi).toHaveBeenCalledWith(documentItem.id, expect.anything())
    );
    expect(findSwalCall((options) => options.title === "กำลังลบเอกสาร")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );

    deletion.resolve({ id: documentItem.id, deleted: true });

    let successModal: Record<string, unknown> | undefined;
    await waitFor(() => {
      successModal = findSwalCall((options) => options.title === "ลบเอกสารสำเร็จ");
      expectAcknowledgedResultModal(successModal, "ลบเอกสารสำเร็จ");
    });
  });
});
