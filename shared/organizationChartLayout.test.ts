import { describe, expect, it } from "vitest";
import { chartPlacement, parseOrganizationChartLayout } from "./organizationChartLayout";

describe("organization chart layout validation", () => {
  it("accepts independent rows and an acyclic reporting chain", () => {
    const layout = parseOrganizationChartLayout({
      director: { level: 1, row: 1, order: 0, parentPositionId: null },
      deputy: { level: 2, row: 1, order: 1, parentPositionId: "director" },
      head: { level: 3, row: 2, order: 0, parentPositionId: "deputy" }
    });
    expect(layout.head.parentPositionId).toBe("deputy");
    expect(layout.head.row).toBe(2);
  });

  it("rejects cycles, same-level managers, missing parents, and injected data", () => {
    expect(() =>
      parseOrganizationChartLayout({
        director: { level: 1, row: 1, order: 0, parentPositionId: "head" },
        head: { level: 2, row: 1, order: 0, parentPositionId: "director" }
      })
    ).toThrow(/higher level/);
    expect(() =>
      parseOrganizationChartLayout({
        a: { level: 1, row: 1, order: 0, parentPositionId: "absent" }
      })
    ).toThrow(/higher level/);
    expect(() =>
      parseOrganizationChartLayout({
        a: { level: 1, row: 1, order: 0, parentPositionId: null, __proto__: "bad", html: "<script>" }
      })
    ).toThrow(/unexpected chart position field/);
    expect(() => parseOrganizationChartLayout({ a: { level: -1, row: 1, order: 0, parentPositionId: null } })).toThrow(
      /invalid chart level/
    );
  });

  it("uses existing group sort order only as a backward-compatible visual fallback", () => {
    expect(chartPlacement(undefined, { id: "p1", groupSortOrder: 2, sortOrder: 9 })).toEqual({
      level: 3,
      row: 1,
      order: 9,
      parentPositionId: null
    });
  });
});
