import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicOrganizationPosition } from "../../features/public-organization";
import OrganizationChartView from "./OrganizationChartView";

function position(id: string, title: string, name: string): PublicOrganizationPosition {
  return {
    id,
    unitContentId: "office",
    title,
    groupLabel: "",
    groupSortOrder: 0,
    sortOrder: 0,
    displayStyle: "default",
    assignments: [
      {
        id: `assignment-${id}`,
        sortOrder: 0,
        dutyDetail: "",
        person: {
          id: `person-${id}`,
          displayName: name,
          personnelType: "teacher",
          employmentPosition: "",
          educationQualifications: "",
          photoMediaId: null,
          publicEmail: "",
          publicPhone: ""
        }
      }
    ]
  };
}

const positions = [position("director", "ผู้อำนวยการ", "นาย ก"), position("head", "หัวหน้างาน", "นาง ข")];
const layout = {
  director: { level: 1, row: 1, order: 0, parentPositionId: null },
  head: { level: 2, row: 1, order: 1, parentPositionId: "director" }
};

describe("public organization chart A/B", () => {
  it("renders separate, legible portrait rows with placement labels", () => {
    render(
      <OrganizationChartView
        mode="rows"
        positions={positions}
        layout={layout}
        media={new Map()}
        showEducationQualifications={false}
      />
    );
    expect(screen.getByRole("region", { name: "แถวระดับ 1 แถว 1 เลื่อนแนวนอนได้" })).toHaveClass("rcat-focus-ring");
    expect(screen.getByRole("region", { name: "ระดับ 1 แถว 1" })).toHaveTextContent("นาย ก");
    expect(screen.getByRole("region", { name: "ผังบุคลากรแบบระดับและแถว เลื่อนแนวนอนได้" })).toHaveAttribute(
      "data-org-position-flow",
      "top-down"
    );
    expect(screen.getByRole("region", { name: "ระดับ 1 แถว 1" }).nextElementSibling).toHaveAttribute(
      "data-org-level",
      "2"
    );
    expect(screen.getByRole("region", { name: "ระดับ 2 แถว 1" })).toHaveTextContent("นาง ข");
    expect(screen.getByText("ผู้อำนวยการ")).toBeInTheDocument();
  });

  it("keeps multiple colleagues in the same A level together, below the director", () => {
    const peer = position("peer", "รองหัวหน้างานอีกคน", "นาย ค");
    const chartLayout = {
      ...layout,
      peer: { level: 2, row: 1, order: 2, parentPositionId: "director" }
    };
    render(
      <OrganizationChartView
        mode="rows"
        positions={[...positions, peer]}
        layout={chartLayout}
        media={new Map()}
        showEducationQualifications={false}
      />
    );
    const chart = screen.getByRole("region", { name: "ผังบุคลากรแบบระดับและแถว เลื่อนแนวนอนได้" });
    const levelTwo = within(chart).getByRole("region", { name: "ระดับ 2 แถว 1" });
    expect(within(levelTwo).getByText("นาง ข")).toBeInTheDocument();
    expect(within(levelTwo).getByText("นาย ค")).toBeInTheDocument();
    expect(within(chart).getByRole("region", { name: "ระดับ 1 แถว 1" })).not.toContainElement(levelTwo);
  });

  it("renders two people assigned to one position as two distinct side-by-side cards", () => {
    const holder = position("teachers", "ครู", "ครูคนที่หนึ่ง");
    const coholder = position("other", "ครู", "ครูคนที่สอง").assignments[0];
    const together = { ...holder, assignments: [...holder.assignments, coholder] };
    render(
      <OrganizationChartView mode="rows" positions={[together]} media={new Map()} showEducationQualifications={false} />
    );
    const positionGroup = document.querySelector('[data-org-position-cards="teachers"]');
    expect(positionGroup).toBeInTheDocument();
    expect(positionGroup?.querySelectorAll(".MuiCard-root")).toHaveLength(2);
    expect(within(positionGroup as HTMLElement).getByText("ครูคนที่หนึ่ง")).toBeInTheDocument();
    expect(within(positionGroup as HTMLElement).getByText("ครูคนที่สอง")).toBeInTheDocument();
  });

  it("renders a scrollable reporting tree without inventing additional personnel", () => {
    render(
      <OrganizationChartView
        mode="tree"
        positions={positions}
        layout={layout}
        media={new Map()}
        showEducationQualifications={false}
      />
    );
    const region = screen.getByRole("region", { name: /ผังสายบังคับบัญชา/ });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("rcat-focus-ring");
    expect(region).toHaveAttribute("data-org-position-flow", "top-down");
    expect(within(region).getByText("นาง ข").closest("li")).toHaveAttribute("data-org-position-id", "head");
    expect(within(region).getByText("นาย ก")).toBeInTheDocument();
    expect(within(region).getByText("นาง ข")).toBeInTheDocument();
    expect(within(region).queryByText("บุคลากรตัวอย่างอื่น")).not.toBeInTheDocument();
  });
});
