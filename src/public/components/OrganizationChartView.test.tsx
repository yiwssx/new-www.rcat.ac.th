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
    expect(screen.getByRole("region", { name: "ระดับ 2 แถว 1" })).toHaveTextContent("นาง ข");
    expect(screen.getByText("ผู้อำนวยการ")).toBeInTheDocument();
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
    expect(within(region).getByText("นาย ก")).toBeInTheDocument();
    expect(within(region).getByText("นาง ข")).toBeInTheDocument();
    expect(within(region).queryByText("บุคลากรตัวอย่างอื่น")).not.toBeInTheDocument();
  });
});
