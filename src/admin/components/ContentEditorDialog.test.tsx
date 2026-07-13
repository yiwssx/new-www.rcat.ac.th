import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ContentItem, MediaAsset } from "../../types";
import ContentEditorDialog from "./ContentEditorDialog";

const mediaPaginationMock = vi.hoisted(() => ({
  getAdminMediaByIds: vi.fn(async (_ids: readonly string[]): Promise<MediaAsset[]> => [])
}));

vi.mock("../../features/admin-pagination", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/admin-pagination")>()),
  adminMediaListQueryOptions: () => ({
    queryKey: ["test-admin-media-list"],
    queryFn: async () => ({
      items: [],
      pagination: {
        page: 1,
        pageSize: 24,
        totalItems: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false
      },
      generatedAt: "2026-07-09T00:00:00.000Z"
    })
  }),
  getAdminMediaByIds: mediaPaginationMock.getAdminMediaByIds
}));

function createContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "facebook-content-1",
    title: "ข่าว Facebook",
    slug: "facebook-content-1",
    type: "news",
    status: "published",
    owner: "facebook-import",
    summary: "สรุปข่าว Facebook",
    body: "โพสต์นี้แสดงจาก Facebook ต้นฉบับ\n\nที่มา:",
    category: "กิจกรรม",
    tags: ["Facebook"],
    canonicalUrl: "",
    readingMinutes: 1,
    template: "facebook-embed",
    mediaIds: [],
    updatedAt: "2026-07-09T00:00:00.000Z",
    publishAt: "2026-07-09T00:00:00.000Z",
    ...overrides
  };
}

function renderEditor(item: ContentItem) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ContentEditorDialog open item={item} mediaAssets={[]} onClose={vi.fn()} onSave={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("ContentEditorDialog", () => {
  it("shows the Facebook Embed label and missing canonical_url warning", () => {
    renderEditor(createContentItem());

    expect(screen.getByText("Facebook Embed")).toBeInTheDocument();
    expect(screen.getByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มี URL หลักสำหรับฝังโพสต์ Facebook")).toBeInTheDocument();
  });

  it("keeps the Facebook Embed guidance visible in the save confirmation preview", () => {
    renderEditor(
      createContentItem({
        canonicalUrl: "https://www.facebook.com/100063746585360/posts/111"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));

    expect(screen.getByText("Facebook Embed")).toBeInTheDocument();
    expect(screen.getByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).toBeInTheDocument();
    expect(screen.getByText("https://www.facebook.com/100063746585360/posts/111")).toBeInTheDocument();
  });

  it("loads selected media by id even when it is outside the current library page", async () => {
    const selectedAsset: MediaAsset = {
      id: "off-page-media",
      name: "ภาพที่แนบไว้",
      type: "image",
      size: "1 MB",
      owner: "editor",
      driveUrl: "https://drive.google.com/file/d/off-page-media/view",
      previewUrl: "https://drive.google.com/file/d/off-page-media/preview",
      updatedAt: "2026-07-09T00:00:00.000Z"
    };
    mediaPaginationMock.getAdminMediaByIds.mockResolvedValueOnce([selectedAsset]);

    renderEditor(createContentItem({ mediaIds: [selectedAsset.id], featuredMediaId: selectedAsset.id }));

    expect(await screen.findByText(selectedAsset.name)).toBeInTheDocument();
    expect(mediaPaginationMock.getAdminMediaByIds).toHaveBeenCalledWith([selectedAsset.id]);
  });
});
