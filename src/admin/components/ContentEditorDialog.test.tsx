import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ContentItem } from "../../types";
import ContentEditorDialog from "./ContentEditorDialog";

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

describe("ContentEditorDialog Facebook embed admin guidance", () => {
  it("shows the Facebook Embed label and missing canonical_url warning", () => {
    render(<ContentEditorDialog open item={createContentItem()} mediaAssets={[]} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText("Facebook Embed")).toBeInTheDocument();
    expect(screen.getByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).toBeInTheDocument();
    expect(screen.getByText("ยังไม่มี URL หลักสำหรับฝังโพสต์ Facebook")).toBeInTheDocument();
  });

  it("keeps the Facebook Embed guidance visible in the save confirmation preview", () => {
    render(
      <ContentEditorDialog
        open
        item={createContentItem({
          canonicalUrl: "https://www.facebook.com/100063746585360/posts/111"
        })}
        mediaAssets={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));

    expect(screen.getByText("Facebook Embed")).toBeInTheDocument();
    expect(screen.getByText("รายการนี้จะแสดงเป็นโพสต์ Facebook แบบฝังในหน้าเว็บไซต์สาธารณะ")).toBeInTheDocument();
    expect(screen.getByText("https://www.facebook.com/100063746585360/posts/111")).toBeInTheDocument();
  });
});
