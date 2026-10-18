import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicOrganizationPosition, PublicOrganizationUnit } from "../../features/public-organization/api";
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
    // The detail route retains the summary; the compact unit navigator must only show links.
    const diagram = screen.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
    expect(within(diagram).queryByText(/รายละเอียด/)).not.toBeInTheDocument();
    expect(within(diagram).getByRole("link", { name: title })).toBeInTheDocument();
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

function position(
  id: string,
  unitContentId: string,
  personId: string,
  displayName = "บุคลากรคนเดียวกัน",
  qualifications = "ปริญญาโท"
): PublicOrganizationPosition {
  return {
    id,
    unitContentId,
    title: "ตำแหน่ง " + id,
    groupLabel: "",
    groupSortOrder: 0,
    sortOrder: 0,
    displayStyle: "default",
    assignments: [
      {
        id: "assignment-" + id,
        dutyDetail: "หน้าที่ " + id,
        sortOrder: 0,
        person: {
          id: personId,
          displayName,
          personnelType: "teacher",
          employmentPosition: "ครู",
          educationQualifications: qualifications,
          photoMediaId: null,
          publicEmail: "",
          publicPhone: ""
        }
      }
    ]
  };
}

describe("Organization V2.4 leaf-page presentation", () => {
  it("skips a one-card unit hierarchy and duplicate public headings while keeping personnel visible", () => {
    const root = { ...unit("root", null), chartMode: "rows" as const };
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy([root], "root")}
        positionsByUnit={new Map([["root", [position("lead", "root", "person-1")]]])}
        media={new Map()}
      />
    );

    expect(screen.queryByRole("heading", { name: "ผังโครงสร้างหน่วยงาน" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ผังบุคลากร" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "หน่วยงาน root" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ผังบุคลากร หน่วยงาน root" })).toBeInTheDocument();
    expect(screen.getByText("บุคลากรคนเดียวกัน")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ผังบุคลากรแบบระดับและแถว เลื่อนแนวนอนได้" })).toHaveAttribute(
      "data-org-position-flow",
      "top-down"
    );
  });

  it("retains the horizontal unit navigator and distinct descendant headings when children exist", () => {
    const units = [{ ...unit("root", null), unitKind: "division", title: "ฝ่ายบริหาร" }, unit("child", "root")];
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy(units, "root")}
        positionsByUnit={new Map([["child", [position("lead", "child", "person-1")]]])}
        media={new Map()}
      />
    );
    expect(screen.getByRole("heading", { name: "ผังโครงสร้างหน่วยงาน" })).toBeInTheDocument();
    expect(screen.queryByText("ผังแสดงหน่วยงานแม่ด้านบนและหน่วยงานลูกด้านล่าง หน่วยงานระดับเดียวกันอยู่ข้างกัน")).not.toBeInTheDocument();
    const diagram = screen.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
    expect(within(diagram).getAllByRole("link")).toHaveLength(2);
    expect(diagram.querySelectorAll('[data-org-unit-navigation-card="true"]')).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "หน่วยงาน child" })).toBeInTheDocument();
    expect(screen.getByText("บุคลากรคนเดียวกัน")).toBeInTheDocument();
  });
});

describe("Organization V2.2 Phase 3 position composition", () => {
  it("renders each saved mode inside its own unit with a shared person's distinct duty assignments exactly once", () => {
    const root = {
      ...unit("root", null),
      unitKind: "division",
      title: "ฝ่ายบริหาร",
      chartMode: "rows" as const,
      chartLayout: { lead: { level: 1, row: 1, order: 0, parentPositionId: null } }
    };
    const department = {
      ...unit("department", "root"),
      unitKind: "department",
      chartMode: "tree" as const,
      chartLayout: { teacher: { level: 1, row: 1, order: 0, parentPositionId: null } }
    };
    const work = { ...unit("work", "root"), chartMode: "cards" as const };
    const units = [root, department, work, unit("empty", "root")];
    const positionsByUnit = new Map<string, PublicOrganizationPosition[]>([
      ["root", [position("lead", "root", "person-1")]],
      ["department", [position("teacher", "department", "person-1")]],
      ["work", [position("assistant", "work", "person-2", "ผู้ช่วยงาน")]]
    ]);
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy(units, "root")}
        positionsByUnit={positionsByUnit}
        media={new Map()}
      />
    );
    const rootPositions = screen.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" });
    const leadSection = within(rootPositions).getByRole("region", { name: "แถวระดับ 1 แถว 1 เลื่อนแนวนอนได้" });
    expect(screen.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" })).not.toContainElement(
      leadSection
    );
    expect(within(rootPositions).getByRole("region", { name: "ผังบุคลากร ฝ่ายบริหาร" })).toBeInTheDocument();
    expect(within(leadSection).getByText("ตำแหน่ง lead")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /ผังสายบังคับบัญชา/ })).toBeInTheDocument();
    expect(screen.getAllByText("บุคลากรคนเดียวกัน")).toHaveLength(2);
    expect(screen.queryByText("หน้าที่ lead")).not.toBeInTheDocument();
    expect(screen.queryByText(/วุฒิการศึกษา: ปริญญาโท/)).not.toBeInTheDocument();
    expect(screen.getByText("ผู้ช่วยงาน")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "หน่วยงาน empty" })).toBeInTheDocument();
    const staffDetails = screen.getAllByRole("button", { name: "ดูรายละเอียด บุคลากรคนเดียวกัน" });
    fireEvent.click(staffDetails[0]);
    expect(screen.getByText("หน้าที่ lead")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
    fireEvent.click(staffDetails[1]);
    expect(screen.getByText("หน้าที่ teacher")).toBeInTheDocument();
    expect(screen.getByText("ปริญญาโท")).toBeInTheDocument();
    expect(screen.getAllByText("ตำแหน่ง assistant")).toHaveLength(1);
  });

  it("renders multiple Cards positions within a horizontally scrollable rail instead of one card per row", () => {
    const root = { ...unit("root", null), chartMode: "cards" as const };
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy([root], "root")}
        positionsByUnit={
          new Map([["root", [position("lead", "root", "person-1"), position("assistant", "root", "person-2")]]])
        }
      />
    );
    const rail = screen.getByRole("region", { name: "ตำแหน่งของหน่วยงาน root เลื่อนแนวนอนได้" });
    expect(rail).toHaveAttribute("tabindex", "0");
    expect(rail).toHaveClass("rcat-focus-ring");
    expect(within(rail).getByText("ตำแหน่ง lead")).toBeInTheDocument();
    expect(within(rail).getByText("ตำแหน่ง assistant")).toBeInTheDocument();
  });

  it("keeps A/B/Cards charts outside narrow diagram cards when descendant unit navigation is present", () => {
    const root = { ...unit("root", null), chartMode: "rows" as const };
    const descendant = unit("child", "root");
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy([root, descendant], "root")}
        positionsByUnit={
          new Map([["root", [position("lead", "root", "person-1"), position("deputy", "root", "person-2")]]])
        }
      />
    );
    const diagram = screen.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
    const personnel = screen.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" });
    const rows = within(personnel).getByRole("region", { name: "ผังบุคลากรแบบระดับและแถว เลื่อนแนวนอนได้" });
    expect(diagram).not.toContainElement(rows);
    expect(rows).toHaveAttribute("data-org-position-flow", "top-down");
    expect(within(personnel).getByText("ตำแหน่ง deputy")).toBeInTheDocument();
  });

  it("does not display department-only qualifications within a non-department cards unit", () => {
    const units = [
      { ...unit("root", null), unitKind: "division", title: "ฝ่ายบริหาร" },
      { ...unit("work", "root"), chartMode: "cards" as const }
    ];
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy(units, "root")}
        positionsByUnit={new Map([["work", [position("assistant", "work", "person-1")]]])}
        media={new Map()}
      />
    );
    expect(screen.getByText("บุคลากรคนเดียวกัน")).toBeInTheDocument();
    expect(screen.queryByText(/วุฒิการศึกษา:/)).not.toBeInTheDocument();
  });

  it("never draws unrelated or disconnected unit personnel inside the chosen root", () => {
    const units = [
      { ...unit("root", null), unitKind: "division", title: "ฝ่ายบริหาร" },
      unit("sub", "root"),
      unit("orphan", "other")
    ];
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy(units, "root")}
        positionsByUnit={
          new Map([
            ["sub", [position("sub-position", "sub", "one", "คนที่เผยแพร่")]],
            ["orphan", [position("orphan-position", "orphan", "two", "คนที่ไม่อยู่ในผัง")]]
          ])
        }
        media={new Map()}
      />
    );
    expect(screen.getByText("คนที่เผยแพร่")).toBeInTheDocument();
    expect(screen.queryByText("คนที่ไม่อยู่ในผัง")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "หน่วยงาน orphan" })).not.toBeInTheDocument();
  });

  it("shows only the selected work or department people while preserving child navigation links", () => {
    const root = unit("root", null);
    const child = { ...unit("child", "root"), unitKind: "department" };
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy([root, child], "root")}
        positionsByUnit={
          new Map([
            ["root", [position("direct", "root", "p1", "บุคลากรงานนี้")]],
            ["child", [position("elsewhere", "child", "p2", "บุคลากรแผนกอื่น")]]
          ])
        }
      />
    );
    expect(screen.getByText("บุคลากรงานนี้")).toBeInTheDocument();
    expect(screen.queryByText("บุคลากรแผนกอื่น")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "หน่วยงาน child" })).toBeInTheDocument();
  });

  it("starts academic divisions in B/direct mode and allows deliberate all or selected-unit views", () => {
    const root = { ...unit("academic", null), unitKind: "division", title: "ฝ่ายวิชาการ" };
    const child = unit("work", "academic");
    const department = { ...unit("dept", "academic"), unitKind: "department" };
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy([root, child, department], "academic")}
        positionsByUnit={
          new Map([
            ["academic", [position("leader", "academic", "p1", "เจ้าหน้าที่ฝ่าย")]],
            ["work", [position("staff", "work", "p2", "เจ้าหน้าที่งาน")]],
            ["dept", [position("teacher", "dept", "p3", "ครูประจำแผนก")]]
          ])
        }
      />
    );
    expect(screen.getByText("เจ้าหน้าที่ฝ่าย")).toBeInTheDocument();
    expect(screen.queryByText("ครูประจำแผนก")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "หน่วยงาน dept" })).toHaveAttribute("href", "/organization/dept");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "ขอบเขตบุคลากร" }));
    fireEvent.click(screen.getByRole("option", { name: "ทั้งหมดในฝ่ายและหน่วยงานย่อย" }));
    expect(screen.getByText("เจ้าหน้าที่งาน")).toBeInTheDocument();
    expect(screen.getByText("ครูประจำแผนก")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "ขอบเขตบุคลากร" }));
    fireEvent.click(screen.getByRole("option", { name: "เฉพาะหน่วยงาน work" }));
    expect(screen.getByText("เจ้าหน้าที่งาน")).toBeInTheDocument();
    expect(screen.queryByText("ครูประจำแผนก")).not.toBeInTheDocument();
    expect(screen.queryByText("เจ้าหน้าที่ฝ่าย")).not.toBeInTheDocument();
  });

  it("preserves vacant position placeholders for configured chart modes", () => {
    const vacant = { ...position("vacant", "root", "nobody"), assignments: [] };
    render(
      <OrganizationUnitHierarchyView
        hierarchy={buildPublicOrganizationHierarchy([{ ...unit("root", null), chartMode: "rows" }], "root")}
        positionsByUnit={new Map([["root", [vacant]]])}
        media={new Map()}
      />
    );
    expect(screen.getByText("ยังไม่มีผู้ดำรงตำแหน่ง")).toBeInTheDocument();
    expect(screen.queryByText("บุคลากรคนเดียวกัน")).not.toBeInTheDocument();
  });
});
