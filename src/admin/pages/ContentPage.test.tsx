import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readContentDraftRecovery,
  writeContentDraftRecovery,
  type ContentDraftRecoveryMode
} from "../../features/cms-content/draftRecovery";
import type { ContentItem, User } from "../../types";
import ContentPage from "./ContentPage";

const authMock = vi.hoisted(() => ({
  role: "editor" as User["role"]
}));

const paginationMock = vi.hoisted(() => ({
  content: [] as ContentItem[],
  invalidateAdminListQueries: vi.fn()
}));

const contentMock = vi.hoisted(() => ({
  saveContentItem: vi.fn(),
  deleteContentItem: vi.fn(),
  getAdminContentDetail: vi.fn(),
  publishContent: vi.fn()
}));

const publicInvalidationMock = vi.hoisted(() => ({
  invalidateDeletedPublicContent: vi.fn(),
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
    const capabilities =
      authMock.role === "viewer" ? [] : ["content.create", "content.update", "content.delete", "content.publish"];
    const session = { user, capabilities };

    return {
      session,
      capabilities,
      hasCapability: (capability: string) => capabilities.includes(capability),
      login: vi.fn(),
      logout: vi.fn()
    };
  }
}));

vi.mock("../../features/admin-pagination", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination")>()),
  useAdminContentListQuery: () => ({
    data: {
      items: paginationMock.content,
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: paginationMock.content.length,
        totalPages: paginationMock.content.length ? 1 : 0,
        hasPreviousPage: false,
        hasNextPage: false
      },
      generatedAt: "2026-06-24T00:00:00.000Z"
    },
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isPlaceholderData: false
  }),
  invalidateAdminListQueries: paginationMock.invalidateAdminListQueries
}));

vi.mock("../../features/cms-content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-content")>()),
  saveContentItem: contentMock.saveContentItem,
  deleteContentItem: contentMock.deleteContentItem,
  getAdminContentDetail: contentMock.getAdminContentDetail,
  publishContent: contentMock.publishContent
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidateDeletedPublicContent: publicInvalidationMock.invalidateDeletedPublicContent,
  invalidatePublicCmsData: publicInvalidationMock.invalidatePublicCmsData
}));

vi.mock("../components/ContentEditorDialog", () => ({
  default: ({
    open,
    item,
    mode,
    recovered,
    saving,
    errorMessage,
    onSave
  }: {
    open: boolean;
    item: ContentItem | null;
    mode?: ContentDraftRecoveryMode;
    recovered?: boolean;
    saving?: boolean;
    errorMessage?: string;
    onSave: (item: ContentItem) => void;
  }) => {
    if (!open) {
      return null;
    }

    const draft: ContentItem = {
      id: "content-draft",
      title: "Draft content",
      slug: "draft-content",
      type: "news",
      status: "draft",
      owner: "editor",
      summary: "Draft summary",
      body: "Draft body",
      updatedAt: "2026-06-24T00:00:00.000Z",
      publishAt: ""
    };

    return (
      <div role="dialog" aria-label="content-editor">
        {errorMessage && <p>{errorMessage}</p>}
        <span>mock item:{item?.title ?? "new"}</span>
        <span>mock mode:{mode}</span>
        <span>mock recovered:{String(recovered)}</span>
        <button type="button" disabled={saving} onClick={() => onSave(draft)}>
          mock save content
        </button>
      </div>
    );
  }
}));

const contentItem: ContentItem = {
  id: "content-1",
  title: "ประกาศรับสมัคร",
  slug: "admission-news",
  type: "news",
  status: "draft",
  owner: "งานประชาสัมพันธ์",
  summary: "ประกาศรับสมัครนักศึกษา",
  body: "รายละเอียด",
  category: "ข่าว",
  tags: ["สมัครเรียน"],
  mediaIds: [],
  updatedAt: "2026-06-24T00:00:00.000Z",
  publishAt: "",
  revision: 1
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function renderContentPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ContentPage />
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

describe("ContentPage operation feedback", () => {
  beforeEach(() => {
    authMock.role = "editor";
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/admin/content");
    paginationMock.content = [contentItem];
    paginationMock.invalidateAdminListQueries.mockReset();
    paginationMock.invalidateAdminListQueries.mockResolvedValue(undefined);
    contentMock.saveContentItem.mockReset();
    contentMock.saveContentItem.mockResolvedValue(contentItem);
    contentMock.deleteContentItem.mockReset();
    contentMock.deleteContentItem.mockResolvedValue({ id: contentItem.id, deleted: true });
    contentMock.getAdminContentDetail.mockReset();
    contentMock.getAdminContentDetail.mockResolvedValue(contentItem);
    contentMock.publishContent.mockReset();
    contentMock.publishContent.mockResolvedValue({ id: contentItem.id, published: true });
    publicInvalidationMock.invalidatePublicCmsData.mockReset();
    publicInvalidationMock.invalidatePublicCmsData.mockResolvedValue(undefined);
    publicInvalidationMock.invalidateDeletedPublicContent.mockReset();
    publicInvalidationMock.invalidateDeletedPublicContent.mockResolvedValue(undefined);
    swalInstance.fire.mockReset();
    swalInstance.fire.mockResolvedValue({ isConfirmed: true });
    swalInstance.close.mockReset();
    swalInstance.close.mockResolvedValue(undefined);
    swalInstance.showLoading.mockReset();
  });

  it("shows loading and an acknowledged success modal when saving content", async () => {
    const save = deferred<ContentItem>();
    contentMock.saveContentItem.mockReturnValue(save.promise);
    renderContentPage();

    await screen.findByText(contentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "เพิ่มเนื้อหา" }));
    fireEvent.click(screen.getByRole("button", { name: "mock save content" }));

    await waitFor(() => expect(contentMock.saveContentItem).toHaveBeenCalledTimes(1));
    expect(findSwalCall((options) => options.title === "กำลังบันทึกเนื้อหา")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );

    save.resolve(contentItem);

    let successModal: Record<string, unknown> | undefined;
    await waitFor(() => {
      successModal = findSwalCall((options) => options.title === "บันทึกเนื้อหาสำเร็จ");
      expectAcknowledgedResultModal(successModal, "บันทึกเนื้อหาสำเร็จ");
    });
    expect(publicInvalidationMock.invalidatePublicCmsData).toHaveBeenCalledTimes(1);
    expect(publicInvalidationMock.invalidateDeletedPublicContent).not.toHaveBeenCalled();
  }, 15_000);

  it("shows a Facebook Embed label for imported facebook-embed content", async () => {
    paginationMock.content = [
      {
        ...contentItem,
        template: "facebook-embed",
        canonicalUrl: "https://www.facebook.com/100063746585360/posts/111"
      }
    ];

    renderContentPage();

    await screen.findByText(contentItem.title);
    expect(screen.getByText("Facebook Embed")).toBeInTheDocument();
  });

  it("shows loading and an acknowledged success modal when publishing content", async () => {
    const publish = deferred<{ id: string; published: boolean }>();
    contentMock.publishContent.mockReturnValue(publish.promise);
    renderContentPage();

    await screen.findByText(contentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "เผยแพร่" }));

    await waitFor(() => expect(contentMock.publishContent).toHaveBeenCalledTimes(1));
    expect(findSwalCall((options) => options.title === "กำลังเผยแพร่เนื้อหา")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );

    publish.resolve({ id: contentItem.id, published: true });

    let successModal: Record<string, unknown> | undefined;
    await waitFor(() => {
      successModal = findSwalCall((options) => options.title === "เผยแพร่เนื้อหาสำเร็จ");
      expectAcknowledgedResultModal(successModal, "เผยแพร่เนื้อหาสำเร็จ");
    });
    expect(publicInvalidationMock.invalidatePublicCmsData).toHaveBeenCalledTimes(1);
    expect(publicInvalidationMock.invalidateDeletedPublicContent).not.toHaveBeenCalled();
  });

  it("shows loading and an acknowledged success modal when deleting content", async () => {
    const deletion = deferred<{ id: string; deleted: boolean }>();
    contentMock.deleteContentItem.mockReturnValue(deletion.promise);
    renderContentPage();

    await screen.findByText(contentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "ลบ" }));

    await waitFor(() => expect(contentMock.deleteContentItem).toHaveBeenCalledTimes(1));
    expect(findSwalCall((options) => options.title === "กำลังลบเนื้อหา")).toEqual(
      expect.objectContaining({
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false
      })
    );

    deletion.resolve({ id: contentItem.id, deleted: true });

    let successModal: Record<string, unknown> | undefined;
    await waitFor(() => {
      successModal = findSwalCall((options) => options.title === "ลบเนื้อหาสำเร็จ");
      expectAcknowledgedResultModal(successModal, "ลบเนื้อหาสำเร็จ");
    });
    expect(paginationMock.invalidateAdminListQueries).toHaveBeenCalledWith(expect.any(QueryClient), "content");
    expect(publicInvalidationMock.invalidateDeletedPublicContent).toHaveBeenCalledWith(
      expect.any(QueryClient),
      contentItem.slug
    );
    expect(publicInvalidationMock.invalidatePublicCmsData).not.toHaveBeenCalled();
  });

  it("does not invalidate deleted content when deletion is cancelled", async () => {
    swalInstance.fire.mockResolvedValueOnce({ isConfirmed: false });
    renderContentPage();

    await screen.findByText(contentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "ลบ" }));

    await waitFor(() => expect(swalInstance.fire).toHaveBeenCalledTimes(1));
    expect(contentMock.deleteContentItem).not.toHaveBeenCalled();
    expect(paginationMock.invalidateAdminListQueries).not.toHaveBeenCalled();
    expect(publicInvalidationMock.invalidateDeletedPublicContent).not.toHaveBeenCalled();
  });

  it("does not invalidate deleted content when backend deletion fails", async () => {
    contentMock.deleteContentItem.mockRejectedValueOnce(new Error("delete failed"));
    renderContentPage();

    await screen.findByText(contentItem.title);
    fireEvent.click(screen.getByRole("button", { name: "ลบ" }));

    await waitFor(() => expect(findSwalCall((options) => options.title === "ไม่สามารถลบเนื้อหาได้")).toBeDefined());
    expect(paginationMock.invalidateAdminListQueries).not.toHaveBeenCalled();
    expect(publicInvalidationMock.invalidateDeletedPublicContent).not.toHaveBeenCalled();
  });

  it("offers same-user draft recovery and clears the recovery only after a successful save", async () => {
    expect(
      writeContentDraftRecovery({
        mode: "edit",
        ownerUserId: "cloudflare-editor",
        item: { ...contentItem, title: "ฉบับร่างหลังเข้าสู่ระบบใหม่" },
        tagInputValue: "pending-tag"
      })
    ).toBe(true);
    renderContentPage();

    expect(await screen.findByText(/พบฉบับร่างเนื้อหาที่ยังไม่บันทึก/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "เพิ่มเนื้อหา" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "แก้ไข" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "กู้คืนฉบับร่าง" }));
    expect(screen.getByText("mock item:ฉบับร่างหลังเข้าสู่ระบบใหม่")).toBeInTheDocument();
    expect(screen.getByText("mock mode:edit")).toBeInTheDocument();
    expect(screen.getByText("mock recovered:true")).toBeInTheDocument();
    expect(readContentDraftRecovery("cloudflare-editor")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "mock save content" }));
    await waitFor(() => expect(contentMock.saveContentItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readContentDraftRecovery("cloudflare-editor")).toBeNull());
  });
});
