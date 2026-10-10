import { describe, expect, it } from "vitest";
import type {
  OrganizationAssignmentRow,
  OrganizationPositionRow,
  OrganizationUnitListRow
} from "../../features/organization-admin/api";
import {
  assignmentDateToUtc,
  enabledDistinctOccupants,
  flattenOrganizationHierarchy,
  positionsForUnit
} from "./organizationBuilderModel";

function unit(id: string, parent: string | null, sort = 0): OrganizationUnitListRow {
  return {
    content_id: id,
    parent_content_id: parent,
    unit_kind: "work",
    sort_order: sort,
    slug: id,
    title: id,
    summary: "",
    status: "draft",
    publish_at: "",
    unpublish_at: "",
    content_revision: 0,
    unit_revision: 0
  };
}

describe("Phase 6 Organization builder model", () => {
  it("preserves nested units and sibling order regardless of input order", () => {
    expect(
      flattenOrganizationHierarchy([
        unit("child", "root"),
        unit("other", null, 4),
        unit("root", null, 1),
        unit("grandchild", "child")
      ]).map(({ unit: row, depth }) => [row.content_id, depth])
    ).toEqual([
      ["root", 0],
      ["child", 1],
      ["grandchild", 2],
      ["other", 0]
    ]);
  });

  it("does not hang on missing parents or corrupt cycles", () => {
    const tree = flattenOrganizationHierarchy([unit("unloaded", "outside"), unit("a", "b"), unit("b", "a")]);
    expect(tree).toHaveLength(3);
    expect(tree.every((node) => node.detached || node.depth >= 0)).toBe(true);
  });

  it("sorts only the selected unit positions", () => {
    const positions = [
      { id: "p2", unit_content_id: "root", group_sort_order: 1, sort_order: 2 },
      { id: "p3", unit_content_id: "other", group_sort_order: 0, sort_order: 0 },
      { id: "p1", unit_content_id: "root", group_sort_order: 0, sort_order: 4 }
    ] as OrganizationPositionRow[];
    expect(positionsForUnit(positions, "root").map((item) => item.id)).toEqual(["p1", "p2"]);
  });

  it("counts unique active occupants without rejecting multiple duties per person", () => {
    const assignments = [
      { position_id: "p", personnel_id: "a", enabled: 1 },
      { position_id: "p", personnel_id: "a", enabled: 1 },
      { position_id: "p", personnel_id: "b", enabled: 0 },
      { position_id: "p", personnel_id: "c", enabled: 1 }
    ] as OrganizationAssignmentRow[];
    expect(enabledDistinctOccupants(assignments, "p")).toBe(2);
  });
  it("converts Thai-local duty dates to UTC and rejects invalid wall-clock dates", () => {
    expect(assignmentDateToUtc("2026-10-10T09:30")).toBe("2026-10-10T02:30:00.000Z");
    expect(assignmentDateToUtc("2026-02-30T09:30")).toBeNull();
    expect(assignmentDateToUtc("")).toBe("");
  });

  it("preserves stored seconds when an existing date field is unchanged", () => {
    expect(assignmentDateToUtc("2026-10-10T08:20", "2026-10-10T01:20:23.000Z")).toBe("2026-10-10T01:20:23.000Z");
    expect(assignmentDateToUtc("2026-10-10T08:21", "2026-10-10T01:20:23.000Z")).toBe("2026-10-10T01:21:00.000Z");
  });
});
