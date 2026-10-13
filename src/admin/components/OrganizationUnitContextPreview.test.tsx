import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OrganizationUnitListRow } from "../../features/organization-admin";
import OrganizationUnitContextPreview from "./OrganizationUnitContextPreview";
import { focusedUnitContext } from "./organizationUnitContextModel";

function row(id: string, parent: string | null = null, order = 0): OrganizationUnitListRow {
  return {
    content_id: id,
    parent_content_id: parent,
    title: "หน่วยงาน " + id,
    unit_kind: "work",
    slug: id,
    sort_order: order,
    summary: "",
    status: "draft",
    publish_at: "",
    unpublish_at: "",
    chart_mode: "cards",
    content_revision: 7,
    unit_revision: 7
  };
}

describe("Organization V2.3 top-down focused Admin hierarchy", () => {
  it("places the parent above horizontal peers in a keyboard-focusable scroll region", () => {
    const units = [
      row("division"),
      row("work-c", "division", 3),
      row("work-b", "division", 2),
      row("work-a", "division", 1)
    ];
    const onSelect = vi.fn();
    render(<OrganizationUnitContextPreview selected={units[2]} units={units} allUnitsLoaded onSelect={onSelect} />);
    const region = screen.getByRole("region", { name: "ตัวอย่างผังหน่วยงานจากบนลงล่าง เลื่อนแนวนอนเพื่อดูหน่วยงานระดับเดียวกัน" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveAttribute("data-org-direction", "top-down");
    expect(region).toHaveClass("rcat-focus-ring");
    expect(screen.getByText(/ผังหน่วยงานแสดงหน่วยงานแม่ไว้ด้านบน/)).toBeInTheDocument();
    expect(Array.from(region.querySelectorAll("[data-org-level]")).map((level) => level.getAttribute("data-org-level"))).toEqual([
      "parent",
      "peers"
    ]);
    expect(region.querySelector('[data-org-level="parent"]')).toContainElement(
      within(region).getByRole("button", { name: /หน่วยงาน division/ })
    );
    const labels = within(region)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels[0]).toContain("หน่วยงาน division");
    expect(labels.slice(1).map((label) => label?.split("ฉบับร่าง")[0]?.split("หน่วยงานที่กำลังแก้ไข")[0])).toEqual([
      "หน่วยงาน work-a",
      "หน่วยงาน work-b",
      "หน่วยงาน work-c"
    ]);
    const selected = within(region).getByRole("button", { name: /หน่วยงาน work-b/ });
    expect(selected).toHaveAttribute("aria-current", "true");
    fireEvent.click(within(region).getByRole("button", { name: /หน่วยงาน work-c/ }));
    expect(onSelect).toHaveBeenCalledWith(units[1]);
    expect(screen.getByText("Revision: 7")).toBeInTheDocument();
  });

  it("still previews a server-search selection beyond the first 100 loaded units", () => {
    const firstPage = [row("root"), ...Array.from({ length: 100 }, (_, i) => row("page-" + i, "root", i))];
    const distant = row("unit-150", "root", 150);
    render(
      <OrganizationUnitContextPreview selected={distant} units={firstPage} allUnitsLoaded={false} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /หน่วยงาน unit-150/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("status")).toHaveTextContent("แสดงเฉพาะหน่วยงานที่โหลดแล้ว");
    expect(screen.getByRole("region", { name: /ตัวอย่างผังหน่วยงานจากบนลงล่าง/ })).toBeInTheDocument();
  });

  it("does not pretend to know an unloaded parent or unrelated siblings", () => {
    const selected = row("search-result", "hidden-parent", 12);
    const data = focusedUnitContext(selected, [row("root"), row("other", "root")]);
    expect(data.parent).toBeNull();
    expect(data.missingParent).toBe(true);
    expect(data.peers).toEqual([selected]);
    render(
      <OrganizationUnitContextPreview
        selected={selected}
        units={[row("root")]}
        allUnitsLoaded={false}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("ยังไม่โหลดหน่วยงานแม่");
    expect(screen.queryByRole("button", { name: /หน่วยงาน other/ })).not.toBeInTheDocument();
  });

  it("shows the selected root with its loaded children and maintains a readable long Thai name", () => {
    const root = { ...row("root"), title: "ฝ่ายยุทธศาสตร์และแผนงาน".repeat(5), status: "published" as const };
    render(
      <OrganizationUnitContextPreview
        selected={root}
        units={[root, row("child", "root")]}
        allUnitsLoaded
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: new RegExp(root.title) })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /หน่วยงาน child/ })).toBeInTheDocument();
    expect(screen.getByText("สถานะ: เผยแพร่แล้ว")).toBeInTheDocument();
  });
});
