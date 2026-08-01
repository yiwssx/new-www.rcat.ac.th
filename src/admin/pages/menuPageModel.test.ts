import { describe, expect, it } from "vitest";
import type { AdminMenuListItem, AdminMenuOrderItem } from "../../features/admin-pagination";
import {
  buildMenuTree,
  filterMenuTree,
  flattenMenuOrder,
  flattenPublicMenu,
  getNextSiblingOrder,
  moveMenuSibling,
  normalizeMenuHref,
  orderIsDirty,
  parentMenuOptions
} from "./menuPageModel";

const flatItems: AdminMenuListItem[] = [
  {
    id: "child",
    label: "Child",
    href: "/child",
    enabled: true,
    parentId: "parent",
    order: 2,
    updatedAt: "",
    revision: 1
  },
  {
    id: "parent",
    label: "Parent",
    href: "/parent",
    enabled: true,
    parentId: null,
    order: 1,
    updatedAt: "",
    revision: 1
  },
  {
    id: "child-first",
    label: "First child",
    href: "/first-child",
    enabled: false,
    parentId: "parent",
    order: 1,
    updatedAt: "",
    revision: 1
  }
];

const orderItems: AdminMenuOrderItem[] = [
  { id: "parent", label: "Parent", parentId: null, order: 1, enabled: true, revision: 1 },
  { id: "child-first", label: "First child", parentId: "parent", order: 1, enabled: false, revision: 1 },
  { id: "child", label: "Child", parentId: "parent", order: 2, enabled: true, revision: 1 }
];

describe("menuPageModel", () => {
  it("reconstructs the parent/child tree from flat Admin rows regardless of flat row order", () => {
    const tree = buildMenuTree(flatItems);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("parent");
    expect(tree[0]?.children?.map((item) => item.id)).toEqual(["child-first", "child"]);

    expect(flattenPublicMenu(tree).map(({ item, depth }) => [item.id, depth])).toEqual([
      ["parent", 0],
      ["child-first", 1],
      ["child", 1]
    ]);
  });

  it("keeps missing-parent rows reachable as root items instead of losing them", () => {
    const tree = buildMenuTree([
      {
        ...flatItems[0],
        id: "orphan",
        parentId: "missing-parent"
      }
    ]);

    expect(tree.map((item) => item.id)).toEqual(["orphan"]);
  });

  it("does not create an infinite recursive tree for cyclic parent data", () => {
    const cyclic: AdminMenuListItem[] = [
      { ...flatItems[0], id: "a", label: "A", parentId: "b" },
      { ...flatItems[0], id: "b", label: "B", parentId: "a" }
    ];

    const rows = flattenPublicMenu(buildMenuTree(cyclic));

    expect(rows.map(({ item }) => item.id).sort()).toEqual(["a", "b"]);
  });

  it("preserves explicit internal and external hrefs without forcing /content", () => {
    expect(normalizeMenuHref("/admission")).toBe("/admission");
    expect(normalizeMenuHref("admission")).toBe("/admission");
    expect(normalizeMenuHref("/content/admission")).toBe("/content/admission");
    expect(normalizeMenuHref("https://example.org/page")).toBe("https://example.org/page");
    expect(normalizeMenuHref("#section")).toBe("#section");
  });

  it("keeps ancestors visible when a child matches search/filter", () => {
    const tree = buildMenuTree(flatItems);
    const filtered = filterMenuTree(tree, "first child", "disabled");
    const rows = flattenPublicMenu(filtered);

    expect(rows.map(({ item }) => item.id)).toEqual(["parent", "child-first"]);
  });

  it("returns readable parent options with hierarchy depth", () => {
    expect(parentMenuOptions(buildMenuTree(flatItems))).toEqual([
      { id: "parent", label: "Parent", depth: 0 },
      { id: "child-first", label: "First child", depth: 1 },
      { id: "child", label: "Child", depth: 1 }
    ]);
  });

  it("calculates and moves only sibling order", () => {
    expect(getNextSiblingOrder(orderItems, "parent")).toBe(3);

    const moved = moveMenuSibling(orderItems, "child", -1);

    expect(moved.find((item) => item.id === "child")?.order).toBe(1);
    expect(moved.find((item) => item.id === "child-first")?.order).toBe(2);
    expect(moved.find((item) => item.id === "parent")?.order).toBe(1);
  });

  it("detects order changes by persisted order fields", () => {
    expect(orderIsDirty(orderItems, orderItems)).toBe(false);
    expect(orderIsDirty(moveMenuSibling(orderItems, "child", -1), orderItems)).toBe(true);

    expect(flattenMenuOrder(orderItems).map(({ item, depth }) => [item.id, depth])).toEqual([
      ["parent", 0],
      ["child-first", 1],
      ["child", 1]
    ]);
  });
});
