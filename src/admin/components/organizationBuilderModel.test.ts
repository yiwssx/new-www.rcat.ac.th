import { describe, expect, it } from "vitest";
import type {
  OrganizationAssignmentRow,
  OrganizationPositionRow,
  OrganizationUnitListRow
} from "../../features/organization-admin/api";
import {
  enabledDistinctOccupants,
  flattenOrganizationHierarchy,
  organizationTreeItems,
  nextOrganizationSortOrder,
  movePositionBetweenGroups,
  positionGroupsForUnit,
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

  it("creates nested RichTreeView items and marks detached nodes", () => {
    const tree = organizationTreeItems([unit("work", "division"), unit("division", null), unit("child", "work")]);
    expect(tree[0]?.id).toBe("division");
    expect(tree[0]?.children[0]?.id).toBe("work");
    expect(tree[0]?.children[0]?.children[0]?.id).toBe("child");
    expect(organizationTreeItems([unit("orphan", "outside")])[0]?.label).toMatch(/ไม่พบหน่วยงานแม่/);
  });

  it("sorts only the selected unit positions", () => {
    const positions = [
      { id: "p2", unit_content_id: "root", group_sort_order: 1, sort_order: 2 },
      { id: "p3", unit_content_id: "other", group_sort_order: 0, sort_order: 0 },
      { id: "p1", unit_content_id: "root", group_sort_order: 0, sort_order: 4 }
    ] as OrganizationPositionRow[];
    expect(positionsForUnit(positions, "root").map((item) => item.id)).toEqual(["p1", "p2"]);
  });

  it("appends after the highest persisted sibling order, including legacy zero ties", () => {
    expect(nextOrganizationSortOrder([], (row: { sort_order: number }) => row.sort_order)).toBe(0);
    expect(nextOrganizationSortOrder([unit("a", null, 0), unit("b", null, 0)], (row) => row.sort_order)).toBe(2);
    expect(nextOrganizationSortOrder([unit("a", null, 4), unit("b", null, 2)], (row) => row.sort_order)).toBe(5);
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
  it("keeps every group contiguous even if legacy group indexes collide or a label spans multiple indexes", () => {
    const positions = [
      { id: "a", unit_content_id: "work", title: "A", group_label: "หัวหน้า", group_sort_order: 0, sort_order: 0 },
      { id: "b", unit_content_id: "work", title: "B", group_label: "เจ้าหน้าที่", group_sort_order: 0, sort_order: 0 },
      { id: "c", unit_content_id: "work", title: "C", group_label: "เจ้าหน้าที่", group_sort_order: 4, sort_order: 1 },
      {
        id: "outside",
        unit_content_id: "other",
        title: "X",
        group_label: "หัวหน้า",
        group_sort_order: 0,
        sort_order: 0
      }
    ] as OrganizationPositionRow[];
    const groups = positionGroupsForUnit(positions, "work");
    expect(groups.map((group) => [group.label, group.positions.map((item) => item.id)])).toEqual([
      ["เจ้าหน้าที่", ["b", "c"]],
      ["หัวหน้า", ["a"]]
    ]);
    expect(positionsForUnit(positions, "work").map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("allows a sole position to change groups without losing its assigned identity", () => {
    const positions = [
      {
        id: "only",
        unit_content_id: "work",
        title: "Head",
        group_label: "หัวหน้า",
        group_sort_order: 0,
        sort_order: 0
      },
      {
        id: "b",
        unit_content_id: "work",
        title: "Staff",
        group_label: "เจ้าหน้าที่",
        group_sort_order: 1,
        sort_order: 0
      },
      {
        id: "c",
        unit_content_id: "work",
        title: "Staff2",
        group_label: "เจ้าหน้าที่",
        group_sort_order: 1,
        sort_order: 1
      }
    ] as OrganizationPositionRow[];
    const groups = positionGroupsForUnit(positions, "work");
    const moved = movePositionBetweenGroups(groups, "only", "เจ้าหน้าที่");
    expect(moved).toHaveLength(1);
    expect(moved[0]?.positions.map((item) => item.id)).toEqual(["b", "c", "only"]);
    expect(moved[0]?.positions[2]).toBe(positions[0]);
    expect(groups[0]?.positions.map((item) => item.id)).toEqual(["only"]);
    expect(movePositionBetweenGroups(groups, "only", "หัวหน้า")).toEqual(groups);
    expect(movePositionBetweenGroups(groups, "missing", "เจ้าหน้าที่")).toEqual(groups);
  });
});
