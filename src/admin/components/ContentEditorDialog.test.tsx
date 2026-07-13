import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderEditor(
  item: ContentItem,
  options: {
    mediaAssets?: MediaAsset[];
    onSave?: (item: ContentItem) => void;
  } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ContentEditorDialog
        open
        item={item}
        mediaAssets={options.mediaAssets ?? []}
        onClose={vi.fn()}
        onSave={options.onSave ?? vi.fn()}
      />
    </QueryClientProvider>
  );
}

async function selectTemplate(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "เทมเพลต" }));
  await user.click(screen.getByRole("option", { name: label }));
  return user;
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

  it("resolves a blank legacy template with a Facebook URL to Facebook Embed", () => {
    renderEditor(
      createContentItem({
        template: "   ",
        canonicalUrl: "https://www.facebook.com/100063746585360/posts/111"
      })
    );

    expect(screen.getByRole("combobox", { name: "เทมเพลต" })).toHaveTextContent("Facebook Embed");
    expect(screen.getByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).toBeInTheDocument();
    expect(screen.queryByText("ตัวสร้างเนื้อหา")).not.toBeInTheDocument();
  });

  it("keeps an explicit standard template authoritative for a Facebook URL", () => {
    renderEditor(
      createContentItem({
        template: "standard",
        canonicalUrl: "https://www.facebook.com/100063746585360/posts/111"
      })
    );

    expect(screen.getByRole("combobox", { name: "เทมเพลต" })).toHaveTextContent("มาตรฐาน");
    expect(screen.getByText("ตัวสร้างเนื้อหา")).toBeInTheDocument();
    expect(screen.queryByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).not.toBeInTheDocument();
  });

  it("switches from Facebook Embed to standard without discarding URL, body, media, or featured state", async () => {
    const onSave = vi.fn();
    const selectedAsset: MediaAsset = {
      id: "selected-media",
      name: "ภาพเดิม",
      type: "image",
      size: "1 MB",
      owner: "editor",
      driveUrl: "https://drive.google.com/file/d/selected-media/view",
      previewUrl: "https://example.edu/selected-media.jpg",
      updatedAt: "2026-07-09T00:00:00.000Z"
    };
    const item = createContentItem({
      canonicalUrl: "https://www.facebook.com/100063746585360/posts/111",
      body: "เนื้อหาบล็อกเดิม",
      featured: true,
      featuredMediaId: selectedAsset.id,
      mediaIds: [selectedAsset.id]
    });
    renderEditor(item, { mediaAssets: [selectedAsset], onSave });

    const user = await selectTemplate("มาตรฐาน");

    expect(screen.queryByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).not.toBeInTheDocument();
    expect(screen.getByText("ตัวสร้างเนื้อหา")).toBeInTheDocument();
    expect(screen.getByLabelText("ย่อหน้า")).toHaveValue("เนื้อหาบล็อกเดิม");
    expect(screen.getByLabelText("URL หลัก")).toHaveValue(item.canonicalUrl);
    expect(screen.getByRole("checkbox", { name: "เรื่องแนะนำ" })).toBeChecked();
    expect(screen.getAllByText(selectedAsset.name).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));
    expect(screen.getByText("มาตรฐาน")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "standard",
        canonicalUrl: item.canonicalUrl,
        featured: true,
        featuredMediaId: selectedAsset.id,
        mediaIds: [selectedAsset.id]
      })
    );
    expect(onSave.mock.calls[0]?.[0].body).toContain("เนื้อหาบล็อกเดิม");
  }, 15_000);

  it.each([
    ["เนื้อหาเด่น", "feature"],
    ["อัปเดต", "update"],
    ["Facebook Embed", "facebook-embed"]
  ])(
    "persists the %s selection exactly",
    async (label, template) => {
      const onSave = vi.fn();
      renderEditor(
        createContentItem({
          template: "standard",
          canonicalUrl: "https://www.facebook.com/100063746585360/posts/111"
        }),
        { onSave }
      );

      const user = await selectTemplate(label);

      if (template === "facebook-embed") {
        expect(screen.getByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).toBeInTheDocument();
      } else {
        expect(screen.getByText("ตัวสร้างเนื้อหา")).toBeInTheDocument();
      }

      await user.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));
      expect(screen.getByText(label)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "บันทึก" }));

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ template }));
    },
    15_000
  );

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
