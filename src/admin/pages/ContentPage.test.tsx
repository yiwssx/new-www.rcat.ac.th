import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CmsSnapshot, ContentItem, Session, User } from "../../types";
import ContentPage from "./ContentPage";

const authMock = vi.hoisted(() => ({
  role: "editor" as User["role"]
}));

const dashboardMock = vi.hoisted(() => ({
  getAdminCmsSnapshot: vi.fn()
}));

const contentMock = vi.hoisted(() => ({
  saveContentItem: vi.fn(),
  deleteContentItem: vi.fn(),
  getAdminContentDetail: vi.fn(),
  publishContent: vi.fn()
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

vi.mock("../../features/cms-content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/cms-content")>()),
  saveContentItem: contentMock.saveContentItem,
  deleteContentItem: contentMock.deleteContentItem,
  getAdminContentDetail: contentMock.getAdminContentDetail,
  publishContent: contentMock.publishContent
}));

vi.mock("../../services/publicCmsInvalidation", () => ({
  invalidatePublicCmsData: publicInvalidationMock.invalidatePublicCmsData
}));

vi.mock("../components/ContentEditorDialog", () => ({
  default: ({
    open,
    saving,
    errorMessage,
    onSave
  }: {
    open: boolean;
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

function snapshot(content: ContentItem[] = [contentItem]): CmsSnapshot {
  return {
    metrics: [],
    content,
    documents: [],
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
    dashboardMock.getAdminCmsSnapshot.mockReset();
    dashboardMock.getAdminCmsSnapshot.mockResolvedValue(snapshot());
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
  });
});
