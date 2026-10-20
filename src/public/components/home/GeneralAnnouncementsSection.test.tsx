import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicContentCardItem } from "../../../types";
import { GeneralAnnouncementsSection } from "./GeneralAnnouncementsSection";
import { resolveAnnouncementPreview } from "./procurementPreview";

function createAnnouncement(index: number, overrides: Partial<PublicContentCardItem> = {}): PublicContentCardItem {
  return {
    id: `general-${index}`,
    slug: `general-${index}`,
    title: `ประกาศทั่วไป ${index}`,
    type: "announcement",
    status: "published",
    owner: "RCAT",
    category: "ทั่วไป",
    summary: `รายละเอียด ${index}`,
    tags: [],
    publishAt: `2026-10-${String(index).padStart(2, "0")}T00:00:00.000Z`,
    ...overrides
  };
}

describe("GeneralAnnouncementsSection", () => {
  it("renders only the four most recent general announcements with the procurement-style card layout", () => {
    render(
      <GeneralAnnouncementsSection
        items={[
          ...[1, 2, 3, 4, 5].map((index) => createAnnouncement(index)),
          createAnnouncement(6, { id: "procurement", title: "ประกาศจัดซื้อจัดจ้าง", category: "จัดซื้อจัดจ้าง" }),
          createAnnouncement(7, { id: "jobs", title: "ประกาศรับสมัครงาน", category: "รับสมัครงาน" })
        ]}
        mediaAssets={[]}
      />
    );

    const section = document.querySelector("#general-announcements") as HTMLElement;
    expect(within(section).getByText("ประกาศและข้อมูลสำคัญที่ควรทราบจากวิทยาลัย")).toBeInTheDocument();
    const cards = within(section).getAllByRole("article");
    expect(cards).toHaveLength(4);
    expect(cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "ประกาศทั่วไป 5",
      "ประกาศทั่วไป 4",
      "ประกาศทั่วไป 3",
      "ประกาศทั่วไป 2"
    ]);
    expect(within(section).queryByText("ประกาศทั่วไป 1")).not.toBeInTheDocument();
    expect(within(section).queryByText("ประกาศจัดซื้อจัดจ้าง")).not.toBeInTheDocument();
    expect(within(section).queryByText("ประกาศรับสมัครงาน")).not.toBeInTheDocument();
    expect(within(section).getAllByRole("link", { name: /อ่านประกาศทั่วไป/ })).toHaveLength(4);
    expect(within(section).getByRole("link", { name: "ดูทั้งหมด" })).toHaveAttribute("href", "/announcements");
  });

  it("uses the same PDF thumbnail strategy as procurement cards", () => {
    const item = createAnnouncement(1, { bodyDocId: "general-pdf-123" });
    expect(resolveAnnouncementPreview(item, [])).toEqual({
      source: "https://drive.google.com/thumbnail?id=general-pdf-123&sz=w320",
      kind: "pdf",
      label: item.title
    });
    render(<GeneralAnnouncementsSection items={[item]} mediaAssets={[]} />);
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("shows an empty state when there are no general announcements", () => {
    render(<GeneralAnnouncementsSection items={[]} mediaAssets={[]} />);
    expect(screen.getByText("ยังไม่มีประกาศทั่วไป")).toBeInTheDocument();
  });
});
