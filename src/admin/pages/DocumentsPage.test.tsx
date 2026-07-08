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

const draftDocumentItem: CmsDocumentItem = {
  id: "document-2",
  title: "แบบฟอร์มคำร้อง",
  description: "เอกสารสำหรับงานทะเบียน",
  category: "แบบฟอร์ม",
  fileUrl: "https://example.invalid/request-form.pdf",
  fileName: "request-form.pdf",
  mediaId: "media-request-form",
  publishedAt: "",
  status: "draft",
  order: 2,
  pinned: false,
  updatedAt: "2026-06-25T00:00:00.000Z",
  revision: 1
};

const pinnedDocumentItem: CmsDocumentItem = {
  id: "document-3",
  title: "ระเบียบฝึกงาน",
  description: "คำแนะนำการฝึกประสบการณ์วิชาชีพ",
  category: "ฝึกงาน",
  fileUrl: "https://example.invalid/internship-policy-with-a-very-long-file-name-that-should-wrap-safely.pdf",
  fileName: "internship-policy.pdf",
  mediaId: "",
  publishedAt: "2026-06-26T00:00:00.000Z",
  status: "published",
  order: 3,
  pinned: true,
  updatedAt: "2026-06-26T00:00:00.000Z",
  revision: 1
};

const secondPinnedDocumentItem: CmsDocumentItem = {
  id: "document-4",
  title: "แผนปฏิบัติการ",
  description: "เอกสารแผนงานประจำปี",
  category: "แผนงาน",
  fileUrl: "https://example.invalid/action-plan.pdf",
  fileName: "action-plan.pdf",
  mediaId: "",
  publishedAt: "2026-06-25T00:00:00.000Z",
  status: "published",
  order: 2,
  pinned: true,
  updatedAt: "2026-06-25T00:00:00.000Z",
  revision: 1
};

function orderingDocuments() {
  return [
    {
      ...pinnedDocumentItem,
      order: 1
    },
    secondPinnedDocumentItem,
    {
      ...documentItem,
      order: 1
    },
    draftDocumentItem
  ];
}

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

function expectTextBefore(leftText: string, rightText: string) {
  const left = screen.getByText(leftText);
  const right = screen.getByText(rightText);

  expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

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

describe("DocumentsPage ordering workflow", () => {
  it("renders pinned and unpinned documents under separate group headings", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot(orderingDocuments()));
    renderDocumentsPage();

    await screen.findByText(pinnedDocumentItem.title);

    expect(screen.getByText("เอกสารปักหมุด")).toBeInTheDocument();
    expect(screen.getByText("เอกสารทั่วไป")).toBeInTheDocument();
    expectTextBefore("เอกสารปักหมุด", pinnedDocumentItem.title);
    expectTextBefore(pinnedDocumentItem.title, secondPinnedDocumentItem.title);
    expectTextBefore(secondPinnedDocumentItem.title, "เอกสารทั่วไป");
    expectTextBefore("เอกสารทั่วไป", documentItem.title);
    expectTextBefore(documentItem.title, draftDocumentItem.title);
  });

  it("moves documents up and down only within their pinned group and disables group boundaries", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot(orderingDocuments()));
    renderDocumentsPage();

    await screen.findByText(pinnedDocumentItem.title);

    expect(screen.getByRole("button", { name: `เลื่อนขึ้น ${pinnedDocumentItem.title}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `เลื่อนลง ${secondPinnedDocumentItem.title}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `เลื่อนขึ้น ${documentItem.title}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `เลื่อนลง ${draftDocumentItem.title}` })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: `เลื่อนขึ้น ${secondPinnedDocumentItem.title}` }));

    expectTextBefore(secondPinnedDocumentItem.title, pinnedDocumentItem.title);
    expectTextBefore(pinnedDocumentItem.title, "เอกสารทั่วไป");
    expectTextBefore(documentItem.title, draftDocumentItem.title);

    fireEvent.click(screen.getByRole("button", { name: `เลื่อนลง ${documentItem.title}` }));

    expectTextBefore(draftDocumentItem.title, documentItem.title);
    expectTextBefore(pinnedDocumentItem.title, "เอกสารทั่วไป");
    expectTextBefore("เอกสารทั่วไป", draftDocumentItem.title);
  });

  it("enables save after moving and can reset the local ordering draft", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot(orderingDocuments()));
    renderDocumentsPage();

    await screen.findByText(pinnedDocumentItem.title);
    expect(screen.getByRole("button", { name: "บันทึกลำดับเอกสาร" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: `เลื่อนขึ้น ${secondPinnedDocumentItem.title}` }));

    expect(screen.getByRole("button", { name: "บันทึกลำดับเอกสาร" })).toBeEnabled();
    expectTextBefore(secondPinnedDocumentItem.title, pinnedDocumentItem.title);

    fireEvent.click(screen.getByRole("button", { name: "ยกเลิกการจัดลำดับ" }));

    expect(screen.getByRole("button", { name: "บันทึกลำดับเอกสาร" })).toBeDisabled();
    expectTextBefore(pinnedDocumentItem.title, secondPinnedDocumentItem.title);
  });

  it("saves only changed document order values and invalidates public CMS data", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot(orderingDocuments()));
    documentsMock.saveDocumentToApi.mockImplementation(async (document: CmsDocumentItem) => document);
    renderDocumentsPage();

    await screen.findByText(pinnedDocumentItem.title);
    fireEvent.click(screen.getByRole("button", { name: `เลื่อนขึ้น ${secondPinnedDocumentItem.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลำดับเอกสาร" }));

    await waitFor(() => expect(documentsMock.saveDocumentToApi).toHaveBeenCalledTimes(2));
    expect(documentsMock.saveDocumentToApi).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: secondPinnedDocumentItem.id,
        order: 1,
        pinned: true
      })
    );
    expect(documentsMock.saveDocumentToApi).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: pinnedDocumentItem.id,
        order: 2,
        pinned: true
      })
    );
    expect(documentsMock.saveDocumentToApi).not.toHaveBeenCalledWith(expect.objectContaining({ id: documentItem.id }));
    expect(publicInvalidationMock.invalidatePublicCmsData).toHaveBeenCalledTimes(1);
    expect(findSwalCall((options) => options.title === "บันทึกลำดับเอกสารสำเร็จ")).toEqual(
      expect.objectContaining({
        icon: "success",
        confirmButtonText: "ตกลง"
      })
    );
  });

  it("keeps local order draft and shows an error modal when order save fails", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot(orderingDocuments()));
    documentsMock.saveDocumentToApi.mockRejectedValue(new Error("D1 unavailable"));
    renderDocumentsPage();

    await screen.findByText(pinnedDocumentItem.title);
    fireEvent.click(screen.getByRole("button", { name: `เลื่อนขึ้น ${secondPinnedDocumentItem.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึกลำดับเอกสาร" }));

    expect(await screen.findByText(secondPinnedDocumentItem.title)).toBeInTheDocument();
    expectTextBefore(secondPinnedDocumentItem.title, pinnedDocumentItem.title);
    expect(screen.getByRole("button", { name: "บันทึกลำดับเอกสาร" })).toBeEnabled();
    expect(findSwalCall((options) => options.title === "ไม่สามารถบันทึกลำดับเอกสารได้")).toEqual(
      expect.objectContaining({
        icon: "error",
        text: "D1 unavailable",
        confirmButtonText: "ตกลง"
      })
    );
  });

  it("hides reorder controls and shows a notice while filters are active", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot(orderingDocuments()));
    renderDocumentsPage();

    await screen.findByText(pinnedDocumentItem.title);
    fireEvent.change(screen.getByPlaceholderText("ค้นหาเอกสาร"), { target: { value: "คู่มือ" } });

    expect(screen.getByText("ปิดตัวกรองเพื่อจัดลำดับเอกสารทั้งหมด")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `เลื่อนขึ้น ${documentItem.title}` })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "บันทึกลำดับเอกสาร" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แก้ไข" })).toBeInTheDocument();
  });

  it("does not expose editable raw order in the main document dialog", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot(orderingDocuments()));
    renderDocumentsPage();

    await screen.findByText(pinnedDocumentItem.title);
    fireEvent.click(screen.getAllByRole("button", { name: "แก้ไข" })[0]);

    expect(screen.queryByRole("spinbutton", { name: "ลำดับ" })).not.toBeInTheDocument();
    expect(screen.getByText("ลำดับในกลุ่ม: 1")).toBeInTheDocument();
    expect(screen.getByText("ปรับลำดับจากรายการเอกสารด้านนอกด้วยปุ่มเลื่อนขึ้น/เลื่อนลง")).toBeInTheDocument();
  });
});

describe("DocumentsPage filters and form guidance", () => {
  it("search filters documents by title, category, and file name", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(
      snapshot([documentItem, draftDocumentItem, pinnedDocumentItem])
    );
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    const search = screen.getByPlaceholderText("ค้นหาเอกสาร");

    fireEvent.change(search, { target: { value: "ฝึกงาน" } });
    expect(screen.getByText(pinnedDocumentItem.title)).toBeInTheDocument();
    expect(screen.queryByText(documentItem.title)).not.toBeInTheDocument();
    expect(screen.queryByText(draftDocumentItem.title)).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "student-guide.pdf" } });
    expect(screen.getByText(documentItem.title)).toBeInTheDocument();
    expect(screen.queryByText(pinnedDocumentItem.title)).not.toBeInTheDocument();
    expect(screen.queryByText(draftDocumentItem.title)).not.toBeInTheDocument();
  });

  it("status filter shows only draft or published documents", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(
      snapshot([documentItem, draftDocumentItem, pinnedDocumentItem])
    );
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "สถานะ" }));
    fireEvent.click(screen.getByRole("option", { name: "ฉบับร่าง" }));

    expect(screen.getByText(draftDocumentItem.title)).toBeInTheDocument();
    expect(screen.queryByText(documentItem.title)).not.toBeInTheDocument();
    expect(screen.queryByText(pinnedDocumentItem.title)).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "สถานะ" }));
    fireEvent.click(screen.getByRole("option", { name: "เผยแพร่" }));

    expect(screen.getByText(documentItem.title)).toBeInTheDocument();
    expect(screen.getByText(pinnedDocumentItem.title)).toBeInTheDocument();
    expect(screen.queryByText(draftDocumentItem.title)).not.toBeInTheDocument();
  });

  it("pinned filter shows pinned only and unpinned only documents", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(
      snapshot([documentItem, draftDocumentItem, pinnedDocumentItem])
    );
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "การปักหมุด" }));
    fireEvent.click(screen.getByRole("option", { name: "ปักหมุด" }));

    expect(screen.getByText(pinnedDocumentItem.title)).toBeInTheDocument();
    expect(screen.queryByText(documentItem.title)).not.toBeInTheDocument();
    expect(screen.queryByText(draftDocumentItem.title)).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "การปักหมุด" }));
    fireEvent.click(screen.getByRole("option", { name: "ไม่ปักหมุด" }));

    expect(screen.getByText(documentItem.title)).toBeInTheDocument();
    expect(screen.getByText(draftDocumentItem.title)).toBeInTheDocument();
    expect(screen.queryByText(pinnedDocumentItem.title)).not.toBeInTheDocument();
  });

  it("shows a no-results message when filters match nothing", async () => {
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(
      snapshot([documentItem, draftDocumentItem, pinnedDocumentItem])
    );
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    fireEvent.change(screen.getByPlaceholderText("ค้นหาเอกสาร"), { target: { value: "ไม่มีรายการนี้" } });

    expect(screen.getByText("ไม่พบเอกสารที่ตรงกับเงื่อนไขการค้นหา")).toBeInTheDocument();
    expect(screen.queryByText(documentItem.title)).not.toBeInTheDocument();
  });

  it("keeps Media ID in advanced context with helper text", async () => {
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มเอกสาร" }));

    expect(screen.getByRole("button", { name: "ข้อมูลขั้นสูง" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Media ID" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ข้อมูลขั้นสูง" }));

    expect(screen.getByRole("textbox", { name: "Media ID" })).toBeInTheDocument();
    expect(screen.getByText("ใช้เมื่อเชื่อมโยงกับไฟล์ในคลังสื่อ ระบบทั่วไปไม่จำเป็นต้องกรอกเอง")).toBeInTheDocument();
  });

  it("explains pinned-first behavior for order and pinned controls", async () => {
    renderDocumentsPage();

    await screen.findByText(documentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มเอกสาร" }));

    expect(screen.getByText("ปรับลำดับจากรายการเอกสารด้านนอกด้วยปุ่มเลื่อนขึ้น/เลื่อนลง")).toBeInTheDocument();
    expect(
      screen.getByText("เมื่อเปลี่ยนการปักหมุด รายการจะถูกจัดอยู่ในกลุ่มเอกสารปักหมุดหรือเอกสารทั่วไป")
    ).toBeInTheDocument();
  });
});

describe("DocumentsPage operation feedback", () => {
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
