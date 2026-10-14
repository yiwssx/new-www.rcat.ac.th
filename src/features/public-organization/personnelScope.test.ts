import { describe, expect, it } from "vitest";
import type { PublicOrganizationUnit, PublicOrganizationPosition } from "./api";
import {
  defaultOrganizationPersonnelScope,
  isAcademicDivision,
  publishedDepartmentLinks,
  selectOrganizationPersonnelPositions,
  selectOrganizationPersonnelUnits
} from "./personnelScope";

function unit(id: string, kind: string, parentContentId: string | null): PublicOrganizationUnit {
  return {
    contentId: id,
    parentContentId,
    unitKind: kind,
    title: id,
    slug: id,
    summary: "",
    sortOrder: 0,
    depth: 0
  };
}

function position(id: string, unitId: string): PublicOrganizationPosition {
  return {
    id,
    unitContentId: unitId,
    title: id,
    groupLabel: "",
    groupSortOrder: 0,
    sortOrder: 0,
    displayStyle: "default",
    assignments: []
  };
}

describe("V2.4 organization personnel scope and directory navigation", () => {
  const division = unit("division", "division", null);
  const work = unit("work", "work", "division");
  const department = unit("department", "department", "division");
  const units = [division, work, department];
  const positions = [position("lead", "division"), position("clerk", "work"), position("teacher", "department")];

  it("defaults to direct (B) for academic division and strict unit-only for works/departments", () => {
    expect(isAcademicDivision({ ...division, title: "ฝ่ายวิชาการ" })).toBe(true);
    expect(defaultOrganizationPersonnelScope({ ...division, title: "ฝ่ายวิชาการ" })).toBe("direct");
    expect(defaultOrganizationPersonnelScope(division)).toBe("all");
    expect(defaultOrganizationPersonnelScope(work)).toBe("direct");
    expect(defaultOrganizationPersonnelScope(department)).toBe("direct");
    expect(selectOrganizationPersonnelPositions(work, units, positions, "all").map((x) => x.id)).toEqual(["clerk"]);
    expect(selectOrganizationPersonnelPositions(department, units, positions, "all").map((x) => x.id)).toEqual([
      "teacher"
    ]);
  });

  it("permits explicit all/direct/unit selection within a published subtree", () => {
    expect(selectOrganizationPersonnelPositions(division, units, positions, "all").map((x) => x.id)).toEqual([
      "lead",
      "clerk",
      "teacher"
    ]);
    expect(selectOrganizationPersonnelPositions(division, units, positions, "direct").map((x) => x.id)).toEqual([
      "lead"
    ]);
    expect(selectOrganizationPersonnelPositions(division, units, positions, "unit:work").map((x) => x.id)).toEqual([
      "clerk"
    ]);
    expect([...selectOrganizationPersonnelUnits(division, units, "unit:outside")]).toEqual(["division"]);
    expect([...selectOrganizationPersonnelUnits(division, units, "unit:division")]).toEqual(["division"]);
  });

  it("never invents missing, draft or unsupported department links", () => {
    const published = [unit("root", "department", null), unit("dept-b", "department", "root"), unit("dept-a", "department", "root")];
    expect(publishedDepartmentLinks(published).map((x) => x.contentId)).toEqual(["root", "dept-a", "dept-b"]);
    expect(publishedDepartmentLinks([...published, unit("student", "work", null)])).toHaveLength(3);
  });
});
