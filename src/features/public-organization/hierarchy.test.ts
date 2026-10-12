import { describe, expect, it } from "vitest";
import type { PublicOrganizationUnit } from "./api";
import {
  buildPublicOrganizationHierarchy,
  MAX_PUBLIC_ORGANIZATION_DEPTH,
  MAX_PUBLIC_ORGANIZATION_UNITS
} from "./hierarchy";

function unit(
  contentId: string,
  parentContentId: string | null,
  sortOrder = 0,
  overrides: Partial<PublicOrganizationUnit> = {}
): PublicOrganizationUnit {
  return {
    contentId,
    parentContentId,
    sortOrder,
    unitKind: "work",
    chartMode: "cards",
    chartLayout: {},
    slug: contentId,
    title: contentId,
    summary: "",
    depth: 999,
    ...overrides
  };
}

describe("V2.2 public organization unit hierarchy model", () => {
  it("F1: places three direct children side by side in authoritative sibling order regardless of input order", () => {
    const nodes = [unit("C", "R", 20), unit("B", "R", 10), unit("R", null), unit("A", "R", 10)];
    const result = buildPublicOrganizationHierarchy(nodes, "R");
    expect(result.root?.unit.contentId).toBe("R");
    expect(result.root?.children.map((child) => child.unit.contentId)).toEqual(["A", "B", "C"]);
    expect(result.root?.children.map((child) => child.level)).toEqual([1, 1, 1]);
    expect(result.includedUnitCount).toBe(4);
    expect(result.excludedUnitCount).toBe(0);
    expect(result.issues).toEqual([]);
  });

  it("F2: nests each grandchild beneath its real parent for a four-level unit tree", () => {
    const result = buildPublicOrganizationHierarchy(
      [unit("A1a", "A1"), unit("B1", "B"), unit("R", null), unit("A1", "A"), unit("B", "R"), unit("A", "R")],
      "R"
    );
    const first = result.root?.children[0];
    expect(first?.unit.contentId).toBe("A");
    expect(first?.children[0]?.unit.contentId).toBe("A1");
    expect(first?.children[0]?.children[0]?.unit.contentId).toBe("A1a");
    expect(first?.children[0]?.children[0]?.level).toBe(3);
    expect(result.root?.children[1]?.children[0]?.unit.contentId).toBe("B1");
  });

  it("F3: preserves a single-child chain without changing its saved depth or fabricating a sibling", () => {
    const root = unit("R", "outside", 0, { depth: 8 });
    const nodes = [unit("Grandchild", "Only"), unit("Only", "R"), root];
    const result = buildPublicOrganizationHierarchy(nodes, "R");
    expect(result.root?.children).toHaveLength(1);
    expect(result.root?.children[0]?.children).toHaveLength(1);
    expect(result.root?.unit.depth).toBe(8);
    expect(result.root?.children[0]?.level).toBe(1);
  });

  it("F4: retains over 100 children, sorts them and does not mutate source input", () => {
    const nodes = [
      unit("R", null),
      ...Array.from({ length: 142 }, (_, i) => unit(`u-${i}`, "R", 141 - i))
    ];
    const before = nodes.map((node) => node.contentId);
    const result = buildPublicOrganizationHierarchy(nodes, "R");
    expect(result.root?.children).toHaveLength(142);
    expect(result.root?.children[0]?.unit.contentId).toBe("u-141");
    expect(result.root?.children[141]?.unit.contentId).toBe("u-0");
    expect(result.includedUnitCount).toBe(143);
    expect(nodes.map((node) => node.contentId)).toEqual(before);
  });

  it("F5: preserves mixed cards/A/B chart modes and existing position layouts by reference", () => {
    const savedLayout = { "p-1": { level: 2, row: 1, order: 0, parentPositionId: null } };
    const nodes = [
      unit("R", null),
      unit("A", "R", 0, { chartMode: "rows", chartLayout: savedLayout }),
      unit("B", "R", 1, { chartMode: "tree", chartLayout: savedLayout })
    ];
    const result = buildPublicOrganizationHierarchy(nodes, "R");
    expect(result.root?.unit.chartMode).toBe("cards");
    expect(result.root?.children.map((child) => child.unit.chartMode)).toEqual(["rows", "tree"]);
    expect(result.root?.children[0]?.unit.chartLayout).toBe(savedLayout);
    expect(result.root?.children[1]?.unit.chartLayout).toBe(savedLayout);
  });

  it("F6: rejects duplicate, orphan, self-parent and circular detached entries without losing a valid branch", () => {
    const result = buildPublicOrganizationHierarchy(
      [
        unit("R", null),
        unit("A", "R"),
        unit("A", "R", 0, { title: "duplicate" }),
        unit("orphan", "unknown"),
        unit("self", "self"),
        unit("cycle-1", "cycle-2"),
        unit("cycle-2", "cycle-1"),
        unit("other-root", null),
        unit("empty", "R")
      ],
      "R"
    );
    expect(result.root?.children.map((child) => child.unit.contentId)).toEqual(["A", "empty"]);
    expect(result.includedUnitCount).toBe(3);
    expect(result.excludedUnitCount).toBe(6);
    expect(result.issues).toContain("duplicate-id");
    expect(result.issues).toContain("missing-parent");
    expect(result.issues).toContain("cycle");
    expect(result.issues).toContain("disconnected");
  });

  it("returns an explicit result for missing selected root instead of showing another root", () => {
    const result = buildPublicOrganizationHierarchy([unit("R", null)], "absent");
    expect(result.root).toBeNull();
    expect(result.includedUnitCount).toBe(0);
    expect(result.issues).toContain("missing-root");
  });

  it("fails closed on excessive node count and bounds pathological depth without recursion", () => {
    const tooMany = [unit("R", null), ...Array.from({ length: MAX_PUBLIC_ORGANIZATION_UNITS }, (_, i) => unit(`u${i}`, "R"))];
    const rejected = buildPublicOrganizationHierarchy(tooMany, "R");
    expect(rejected.root).toBeNull();
    expect(rejected.issues).toEqual(["node-limit"]);

    const deep = [unit("R", null)];
    for (let i = 1; i <= MAX_PUBLIC_ORGANIZATION_DEPTH + 3; i += 1) {
      deep.push(unit(`d${i}`, i === 1 ? "R" : `d${i - 1}`));
    }
    const result = buildPublicOrganizationHierarchy(deep, "R");
    expect(result.includedUnitCount).toBe(MAX_PUBLIC_ORGANIZATION_DEPTH + 1);
    expect(result.issues).toContain("depth-limit");
    expect(result.excludedUnitCount).toBe(3);
  });
});
