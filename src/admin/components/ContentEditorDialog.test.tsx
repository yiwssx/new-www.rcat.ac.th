import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAssetInput } from "../../features/cms-media";
import type { ContentItem, MediaAsset } from "../../types";
import ContentEditorDialog from "./ContentEditorDialog";

const mediaPaginationMock = vi.hoisted(() => ({
  getAdminMediaByIds: vi.fn(async (_ids: readonly string[]): Promise<MediaAsset[]> => [])
}));

const filesMock = vi.hoisted(() => ({
  readFileAsBase64: vi.fn(async () => "cGRmLWNvbnRlbnQ=")
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

vi.mock("../../utils/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/files")>()),
  readFileAsBase64: filesMock.readFileAsBase64
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
  item: ContentItem | null,
  options: {
    mediaAssets?: MediaAsset[];
    onSave?: (item: ContentItem) => void;
    onUploadMedia?: (input: MediaAssetInput) => Promise<MediaAsset>;
  } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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
        onUploadMedia={options.onUploadMedia}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mediaPaginationMock.getAdminMediaByIds.mockResolvedValue([]);
  filesMock.readFileAsBase64.mockResolvedValue("cGRmLWNvbnRlbnQ=");
});

async function selectTemplate(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "เทมเพลต" }));
  await user.click(screen.getByRole("option", { name: label }));
}

describe("ContentEditorDialog", () => {
  it("rejects quick-upload files over 10 MB before reading or sending them", () => {
    const onUploadMedia = vi.fn();
    renderEditor(createContentItem({ template: "standard" }), { onUploadMedia });
    const fileInput = document.body.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["pdf"], "too-large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });

    expect(screen.getByText("รองรับไฟล์ขนาดไม่เกิน 10 MB")).toBeInTheDocument();
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    expect(screen.getByText("ไฟล์ต้องมีขนาดไม่เกิน 10 MB")).toBeInTheDocument();
    expect(fileInput).toHaveValue("");
    expect(screen.getByRole("button", { name: "อัปโหลดและแนบ" })).toBeDisabled();
    expect(filesMock.readFileAsBase64).not.toHaveBeenCalled();
    expect(onUploadMedia).not.toHaveBeenCalled();
  });

  it("infers a small PDF as a document and keeps the normal quick-upload flow", async () => {
    const uploadedPdf: MediaAsset = {
      id: "pdf-1",
      name: "annual-report",
      type: "document",
      size: "11 B",
      owner: "editor",
      driveUrl: "https://drive.google.com/file/d/pdf-1/view",
      previewUrl: "https://drive.google.com/file/d/pdf-1/preview",
      updatedAt: "2026-07-14T00:00:00.000Z"
    };
    const onUploadMedia = vi.fn(async () => uploadedPdf);
    renderEditor(createContentItem({ template: "standard", owner: "editor" }), { onUploadMedia });
    const fileInput = document.body.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["pdf-content"], "annual-report.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });
    expect(
      screen.getAllByRole("combobox", { name: "ประเภท" }).find((element) => element.textContent === "เอกสาร")
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "อัปโหลดและแนบ" }));

    await waitFor(() =>
      expect(onUploadMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "annual-report",
          type: "document",
          owner: "editor",
          fileName: "annual-report.pdf",
          mimeType: "application/pdf",
          fileBase64: "cGRmLWNvbnRlbnQ="
        })
      )
    );
    expect(filesMock.readFileAsBase64).toHaveBeenCalledWith(file);
  });

  it("generates a complete Thai slug from title input and keeps a manual slug authoritative", () => {
    renderEditor(null);

    const titleInput = screen.getByRole("textbox", { name: "ชื่อเรื่อง" });
    const slugInput = screen.getByRole("textbox", { name: "slug ลิงก์ถาวร" });

    fireEvent.change(titleInput, { target: { value: "ข่าว" } });
    expect(slugInput).toHaveValue("ข่าว");

    fireEvent.change(titleInput, {
      target: { value: "ข่าวประชาสัมพันธ์รับสมัครนักเรียน" }
    });
    expect(slugInput).toHaveValue("ข่าวประชาสัมพันธ์รับสมัครนักเรียน");

    fireEvent.change(slugInput, {
      target: { value: "ข่าว รับสมัคร / ปี 2569-" }
    });
    expect(slugInput).toHaveValue("ข่าว-รับสมัคร-ปี-2569-");

    fireEvent.change(titleInput, { target: { value: "ชื่อเรื่องใหม่" } });
    expect(slugInput).toHaveValue("ข่าว-รับสมัคร-ปี-2569-");
  });

  it("preserves an imported Thai slug when opening and saving without edits", async () => {
    const onSave = vi.fn();
    const importedSlug = "น้ำเพื่อการเกษตร";
    renderEditor(createContentItem({ slug: importedSlug, template: "standard" }), { onSave });

    expect(screen.getByRole("textbox", { name: "slug ลิงก์ถาวร" })).toHaveValue(importedSlug);

    fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ slug: importedSlug }));
  });

  it("uses the same ordered, deduplicated Thai category slugs in preview, confirmation, and save", async () => {
    const onSave = vi.fn();
    const categoryInput =
      "ข่าวประชาสัมพันธ์, , น้ำเพื่อการเกษตร, วิจัย / นวัตกรรม, ข่าวประชาสัมพันธ์!, น้ำเพื่อการเกษตร";
    const normalizedCategory = "ข่าวประชาสัมพันธ์, น้ำเพื่อการเกษตร, วิจัย / นวัตกรรม, ข่าวประชาสัมพันธ์!";
    const categorySlugPreview = "ข่าวประชาสัมพันธ์, น้ำเพื่อการเกษตร, วิจัย-นวัตกรรม";
    const item = createContentItem({
      template: "standard",
      body: "เนื้อหาทดสอบ",
      canonicalUrl: "https://www.rcat.ac.th/news/example"
    });
    renderEditor(item, { onSave });

    fireEvent.change(screen.getByRole("textbox", { name: "slug ลิงก์ถาวร" }), {
      target: { value: "ข่าว รับสมัคร ปี 2569-" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "หมวดหมู่" }), {
      target: { value: categoryInput }
    });

    expect(screen.getByRole("textbox", { name: "slug หมวดหมู่" })).toHaveValue(categorySlugPreview);

    fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));

    expect(screen.getByText(`หมวดหมู่: ${normalizedCategory}`)).toBeInTheDocument();
    expect(screen.getByText(`slug หมวดหมู่: ${categorySlugPreview}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    const savedItem = onSave.mock.calls[0]?.[0];
    expect(savedItem).toEqual(
      expect.objectContaining({
        slug: "ข่าว-รับสมัคร-ปี-2569",
        category: normalizedCategory,
        template: item.template,
        canonicalUrl: item.canonicalUrl
      })
    );
    expect(savedItem.body).toContain("เนื้อหาทดสอบ");
    expect(savedItem).not.toHaveProperty("categorySlug");
    expect(savedItem).not.toHaveProperty("categorySlugs");
  });

  it("keeps English and numeric permalink sanitization compatible", () => {
    renderEditor(createContentItem({ template: "standard" }));

    fireEvent.change(screen.getByRole("textbox", { name: "slug ลิงก์ถาวร" }), {
      target: { value: "Student Life / Updates 2569" }
    });

    expect(screen.getByRole("textbox", { name: "slug ลิงก์ถาวร" })).toHaveValue("student-life-updates-2569");
  });

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

    await selectTemplate("มาตรฐาน");

    expect(screen.queryByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).not.toBeInTheDocument();
    expect(screen.getByText("ตัวสร้างเนื้อหา")).toBeInTheDocument();
    expect(screen.getByLabelText("ย่อหน้า")).toHaveValue("เนื้อหาบล็อกเดิม");
    expect(screen.getByLabelText("URL หลัก")).toHaveValue(item.canonicalUrl);
    expect(screen.getByRole("checkbox", { name: "เรื่องแนะนำ" })).toBeChecked();
    expect(screen.getAllByText(selectedAsset.name).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));
    expect(screen.getByText("มาตรฐาน")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

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
  });

  it.each([
    ["เนื้อหาเด่น", "feature"],
    ["อัปเดต", "update"],
    ["Facebook Embed", "facebook-embed"]
  ])("persists the %s selection exactly", async (label, template) => {
    const onSave = vi.fn();
    renderEditor(
      createContentItem({
        template: "standard",
        canonicalUrl: "https://www.facebook.com/100063746585360/posts/111"
      }),
      { onSave }
    );

    await selectTemplate(label);

    if (template === "facebook-embed") {
      expect(screen.getByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).toBeInTheDocument();
    } else {
      expect(screen.getByText("ตัวสร้างเนื้อหา")).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));
    expect(screen.getByText(label)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ template }));
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
