import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicOrganizationUnit } from "../../features/public-organization/api";
import { buildPublicOrganizationHierarchy } from "../../features/public-organization/hierarchy";
import OrganizationUnitHierarchyView from "./OrganizationUnitHierarchyView";

function unit(id: string, parentContentId: string | null, sortOrder = 0): PublicOrganizationUnit {
  return {
    contentId: id,
    parentContentId,
    sortOrder,
    title: "หน่วยงาน " + id,
    slug: id,
    summary: "",
    unitKind: "work",
    depth: 0
  };
}

function setup(units: PublicOrganizationUnit[], rootId = "root") {
  return render(<OrganizationUnitHierarchyView hierarchy={buildPublicOrganizationHierarchy(units, rootId)} />);
}

describe("Organization Unit Hierarchy V2.2 Phase 2", () => {
  it("shows horizontal nested branch lists with three root siblings and another level", () => {
    setup([
      unit("root", null),
      unit("alpha", "root", 2),
      unit("beta", "root", 1),
      unit("gamma", "root", 3),
      unit("child", "beta")
    ]);

    const region = screen.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
    const links = within(region).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "หน่วยงาน root",
      "หน่วยงาน beta",
      "หน่วยงาน child",
      "หน่วยงาน alpha",
      "หน่วยงาน gamma"
    ]);
    const root = within(region).getByRole("link", { name: "หน่วยงาน root" }).closest("li");
    const childList = root?.querySelector(":scope > ul");
    expect(childList).not.toBeNull();
    expect(childList?.querySelectorAll(":scope > li")).toHaveLength(3);
    expect(within(region).getByRole("link", { name: "หน่วยงาน child" })).toHaveAttribute("href", "/organization/child");
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("centers the single-child chain without flattening it into a list of sections", () => {
    setup([unit("root", null), unit("next", "root"), unit("third", "next")]);
    const region = screen.getByRole("region", { name: /ผังลำดับชั้นหน่วยงาน/ });
    expect(within(region).getAllByRole("listitem")).toHaveLength(3);
    const first = within(region).getByRole("link", { name: "หน่วยงาน root" }).closest("li");
    const second = first?.querySelector(":scope > ul > li");
    expect(second?.querySelector(":scope > ul > li")).not.toBeNull();
    expect(within(region).getByRole("link", { name: "หน่วยงาน third" })).toBeInTheDocument();
  });

  it("renders over 100 siblings without additional requests or missing unit links", () => {
    const units = [unit("root", null), ...Array.from({ length: 142 }, (_, i) => unit("child-" + i, "root", i))];
    setup(units);
    const region = screen.getByRole("region", { name: /ผังลำดับชั้นหน่วยงาน/ });
    expect(within(region).getAllByRole("link")).toHaveLength(143);
    expect(within(region).getByRole("link", { name: "หน่วยงาน child-141" })).toBeInTheDocument();
  });

  it("preserves very long Thai unit titles and summaries as text", () => {
    const title = "งานวิชาการและการพัฒนาหลักสูตรสถานศึกษา".repeat(6);
    const child = { ...unit("long", "root"), title, summary: "รายละเอียด\nที่ต้องตัดบรรทัดตามพื้นที่" };
    setup([unit("root", null), child]);
    expect(screen.getByRole("link", { name: title })).toHaveAttribute("href", "/organization/long");
    expect(screen.getByText(/รายละเอียด/)).toBeInTheDocument();
  });

  it("fails explicitly rather than building thousands of unbounded DOM nodes", () => {
    setup([unit("root", null), ...Array.from({ length: 501 }, (_, i) => unit("child-" + i, "root", i))]);
    expect(screen.queryByRole("region", { name: /ผังลำดับชั้นหน่วยงาน/ })).not.toBeInTheDocument();
    expect(screen.getByText(/มีจำนวนเกินขอบเขตการแสดงผล/)).toBeInTheDocument();
  });

  it("does not invent a missing root or promote disconnected units", () => {
    setup([unit("orphan", "missing")]);
    expect(screen.queryByRole("region", { name: /ผังลำดับชั้นหน่วยงาน/ })).not.toBeInTheDocument();
    expect(screen.getByText(/ข้อมูลลำดับหน่วยงานไม่ครบถ้วน/)).toBeInTheDocument();
  });
});
