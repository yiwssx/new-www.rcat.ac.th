import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicContentCardItem } from "../types";
import { LatestAnnouncementsCard } from "../public/components/home/LatestAnnouncementsCard";

function createAnnouncement(index: number): PublicContentCardItem {
  return {
    id: `announcement-${index}`,
    title: `ประกาศ ${index}`,
    slug: `announcement-${index}`,
    type: "announcement",
    status: "published",
    owner: "Admin",
    summary: `รายละเอียดประกาศ ${index}`,
    category: "ประกาศ",
    tags: [],
    publishAt: `2026-09-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`
  };
}

describe("homepage compact sidebar cards", () => {
  it("keeps the announcement card compact and limits the homepage preview to three items", () => {
    render(<LatestAnnouncementsCard items={[1, 2, 3, 4].map(createAnnouncement)} />);

    expect(screen.getByRole("heading", { name: "ประกาศล่าสุด", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("ประกาศ 1")).toBeInTheDocument();
    expect(screen.getByText("ประกาศ 2")).toBeInTheDocument();
    expect(screen.getByText("ประกาศ 3")).toBeInTheDocument();
    expect(screen.queryByText("ประกาศ 4")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /อ่านประกาศ/ })).toHaveLength(3);
    expect(screen.getByRole("link", { name: "ทั้งหมด" })).toHaveAttribute("href", "/announcements");
  });
});
