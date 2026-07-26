import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CmsDocumentItem, User } from "../../types";
import DocumentsPage from "./DocumentsPage";

const authMock = vi.hoisted(() => ({ role: "editor" as User["role"] }));

const paginationMock = vi.hoisted(() => ({
  getAdminDocumentList: vi.fn(),
  getAdminDocumentOrder: vi.fn(),
  saveAdminDocumentOrder: vi.fn()
}));

const documentsMock = vi.hoisted(() => ({
  saveDocumentToApi: vi.fn(),
  deleteDocumentFromApi: vi.fn()
}));

const publicInvalidationMock = vi.hoisted(() => ({ invalidatePublicCmsData: vi.fn() }));

const swalInstance = vi.hoisted(() => ({
  fire: vi.fn(),
  close: vi.fn(),
  showLoading: vi.fn()
}));

vi.mock("sweetalert2", () => ({ default: { mixin: vi.fn(() => swalInstance) } }));
vi.mock("sweetalert2/dist/sweetalert2.min.css", () => ({}));

vi.mock("../../features/admin-pagination/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination/api")>()),
  getAdminDocumentList: paginationMock.getAdminDocumentList,
  getAdminDocumentOrder: paginationMock.getAdminDocumentOrder,
  saveAdminDocumentOrder: paginationMock.saveAdminDocumentOrder
}));

vi.mock("../../features/cms-documents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-documents")>()),
  saveDocumentToApi: documentsMock.saveDocumentToApi,
  deleteDocumentFromApi: documentsMock.deleteDocumentFromApi
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidatePublicCmsData: publicInvalidationMock.invalidatePublicCmsData
}));

vi.mock("../../context/authSessionContext", () => ({
  useAuth: () => {
    const user: User = {
      id: `cloudflare-${authMock.role}`,
      name: `Cloudflare ${authMock.role}`,
      email: `${authMock.role}@example.invalid`,
      role: authMock.role
    };
    const capabilities =
      authMock.role === "viewer"
        ? []
        : ["documents.create", "documents.update", "documents.delete", "documents.publish"];
    const session = { user, capabilities };
    return { session, capabilities, login: vi.fn(), logout: vi.fn() };
  }
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

const draftDocumentItem: CmsDocumentItem = {
  ...documentItem,
  id: "document-2",
  title: "แบบฟอร์มคำร้อง",
  fileName: "request-form.pdf",
  status: "draft",
  publishedAt: "",
  order: 2,
  revision: 4
};

const pinnedDocumentItem: CmsDocumentItem = {
  ...documentItem,
  id: "document-3",
  title: "ระเบียบฝึกงาน",
  order: 1,
  pinned: true,
  revision: 2
};

const secondPinnedDocumentItem: CmsDocumentItem = {
  ...pinnedDocumentItem,
  id: "document-4",
  title: "แผนปฏิบัติการ",
  order: 2,
  revision: 3
};

function paginatedDocuments(
  items: CmsDocumentItem[],
  pagination: Partial<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  }> = {}
) {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 25;
  const totalItems = pagination.totalItems ?? items.length;
  const totalPages = pagination.totalPages ?? Math.ceil(totalItems / pageSize);
  return {
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: pagination.hasPreviousPage ?? page > 1,
      hasNextPage: pagination.hasNextPage ?? page < totalPages
    },
    generatedAt: "2026-07-12T00:00:00.000Z"
  };
}

function renderDocumentsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", "/admin/documents");
  authMock.role = "editor";
  paginationMock.getAdminDocumentList.mockReset();
  paginationMock.getAdminDocumentList.mockResolvedValue(paginatedDocuments([documentItem]));
  paginationMock.getAdminDocumentOrder.mockReset();
  paginationMock.getAdminDocumentOrder.mockResolvedValue([
    { id: pinnedDocumentItem.id, title: pinnedDocumentItem.title, order: 1, pinned: true, revision: 2 },
    { id: secondPinnedDocumentItem.id, title: secondPinnedDocumentItem.title, order: 2, pinned: true, revision: 3 },
    { id: documentItem.id, title: documentItem.title, order: 1, pinned: false, revision: 1 }
  ]);
  paginationMock.saveAdminDocumentOrder.mockReset();
  paginationMock.saveAdminDocumentOrder.mockResolvedValue([]);
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

describe("DocumentsPage server pagination", () => {
  it("renders only the requested server page and preserves URL list state", async () => {
    window.history.replaceState({}, "", "/admin/documents?page=2&pageSize=25&status=draft&pinned=unpinned");
    paginationMock.getAdminDocumentList.mockResolvedValue(
      paginatedDocuments([draftDocumentItem], { page: 2, totalItems: 51, totalPages: 3 })
    );

    renderDocumentsPage();

    expect(await screen.findByText(draftDocumentItem.title)).toBeInTheDocument();
    expect(screen.queryByText(documentItem.title)).not.toBeInTheDocument();
    expect(screen.getByText("แสดง 26–50 จากทั้งหมด 51 รายการ")).toBeInTheDocument();
    await waitFor(() =>
      expect(paginationMock.getAdminDocumentList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 25, status: "draft", pinned: "unpinned" })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "ไปหน้าที่ 3" }));

    await waitFor(() => expect(window.location.search).toContain("page=3"));
    await waitFor(() =>
      expect(paginationMock.getAdminDocumentList).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }))
    );
  });

  it("debounces server search and resets search/filter changes to page one", async () => {
    window.history.replaceState({}, "", "/admin/documents?page=3");
    renderDocumentsPage();
    await screen.findByText(documentItem.title);

    fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาเอกสาร" }), { target: { value: "แผนงาน" } });

    await waitFor(() =>
      expect(window.location.search).toContain("q=%E0%B9%81%E0%B8%9C%E0%B8%99%E0%B8%87%E0%B8%B2%E0%B8%99")
    );
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
    await waitFor(
      () =>
        expect(paginationMock.getAdminDocumentList).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, q: "แผนงาน" })
        ),
      { timeout: 1_500 }
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "สถานะ" }));
    fireEvent.click(screen.getByRole("option", { name: "ฉบับร่าง" }));

    await waitFor(() =>
      expect(paginationMock.getAdminDocumentList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, status: "draft" })
      )
    );
  });

  it("moves to the previous valid page after deleting its final item", async () => {
    window.history.replaceState({}, "", "/admin/documents?page=2");
    paginationMock.getAdminDocumentList.mockImplementation(async (request: { page?: number } = {}) =>
      paginatedDocuments(
        [documentItem],
        request.page === 2 ? { page: 2, totalItems: 26, totalPages: 2 } : { page: 1, totalItems: 25, totalPages: 1 }
      )
    );
    renderDocumentsPage();
    await screen.findByText(documentItem.title);

    fireEvent.click(screen.getByRole("button", { name: "ลบ" }));

    await waitFor(() =>
      expect(documentsMock.deleteDocumentFromApi).toHaveBeenCalledWith(documentItem.id, expect.any(Object))
    );
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("page")).toBeNull());
  });

  it("keeps viewer pagination readable while hiding every mutation and ordering control", async () => {
    authMock.role = "viewer";
    renderDocumentsPage();

    expect(await screen.findByText(documentItem.title)).toBeInTheDocument();
    expect(screen.getByText(/มีสิทธิ์อ่านข้อมูลเท่านั้น/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มเอกสาร" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "จัดลำดับ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "แก้ไข" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ลบ" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "การแบ่งหน้ารายการ" })).toBeInTheDocument();
  });
});

describe("DocumentsPage compact ordering", () => {
  it("loads the compact global order only on demand and saves the complete revised collection", async () => {
    renderDocumentsPage();
    await screen.findByText(documentItem.title);
    expect(paginationMock.getAdminDocumentOrder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "จัดลำดับ" }));

    expect(await screen.findByText(pinnedDocumentItem.title)).toBeInTheDocument();
    await waitFor(() => expect(paginationMock.getAdminDocumentOrder).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: `เลื่อนขึ้น ${secondPinnedDocumentItem.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลำดับเอกสาร" }));

    await waitFor(() =>
      expect(paginationMock.saveAdminDocumentOrder).toHaveBeenCalledWith([
        { id: secondPinnedDocumentItem.id, order: 1, pinned: true, revision: 3 },
        { id: pinnedDocumentItem.id, order: 2, pinned: true, revision: 2 },
        { id: documentItem.id, order: 1, pinned: false, revision: 1 }
      ])
    );
    expect(publicInvalidationMock.invalidatePublicCmsData).toHaveBeenCalled();
  });
});
