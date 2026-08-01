import { describe, expect, it } from "vitest";
import type { AdminMenuOrderItem } from "../../features/admin-pagination";
import type { PublicMenuItem } from "../../features/cms-navigation/types";
import {
  filterMenuTree,
  flattenMenuOrder,
  flattenPublicMenu,
  getNextSiblingOrder,
  moveMenuSibling,
  normalizeMenuHref,
  orderIsDirty
} from "./menuPageModel";

const tree: PublicMenuItem[] = [
  {
    id: "menu-about",
    label: "เกี่ยวกับวิทยาลัย",
    href: "/about",
    enabled: true,
    children: [
      {
        id: "menu-history",
        label: "ประวัติวิทยาลัย",
        href: "/history",
        enabled: true
      },
      {
        id: "menu-vision",
        label: "วิสัยทัศน์",
        href: "/vision",
        enabled: false
      }
    ]
  },
  {
    id: "menu-news",
    label: "ข่าวสาร",
    href: "/news",
    enabled: true
  }
];

const order: AdminMenuOrderItem[] = [
  { id: "menu-about", label: "เกี่ยวกับวิทยาลัย", parentId: null, order: 1, enabled: true, revision: 1 },
  { id: "menu-history", label: "ประวัติวิทยาลัย", parentId: "menu-about", order: 1, enabled: true, revision: 2 },
  { id: "menu-vision", label: "วิสัยทัศน์", parentId: "menu-about", order: 2, enabled: false, revision: 3 },
  { id: "menu-news", label: "ข่าวสาร", parentId: null, order: 2, enabled: true, revision: 4 }
];

describe("menuPageModel", () => {
  it.each([
    ["admission", "/admission"],
    ["/admission", "/admission"],
    ["/content/admission", "/content/admission"],
    ["https://example.com/a", "https://example.com/a"],
    ["#contact", "#contact"]
  ])("normalizes %s without inventing /content/", (input, expected) => {
    expect(normalizeMenuHref(input)).toBe(expected);
  });

  it("flattens the public tree with readable parent context", () => {
    expect(flattenPublicMenu(tree).map(({ item, depth, parentLabel }) => [item.label, depth, parentLabel])).toEqual([
      ["เกี่ยวกับวิทยาลัย", 0, null],
      ["ประวัติวิทยาลัย", 1, "เกี่ยวกับวิทยาลัย"],
      ["วิสัยทัศน์", 1, "เกี่ยวกับวิทยาลัย"],
      ["ข่าวสาร", 0, null]
    ]);
  });

  it("keeps a parent visible when only a child matches search", () => {
    const result = filterMenuTree(tree, "ประวัติ", "all");
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("เกี่ยวกับวิทยาลัย");
    expect(result[0]?.children?.map((item) => item.label)).toEqual(["ประวัติวิทยาลัย"]);
  });

  it("filters visibility without flattening hierarchy", () => {
    const result = filterMenuTree(tree, "", "disabled");
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("เกี่ยวกับวิทยาลัย");
    expect(result[0]?.children?.map((item) => item.label)).toEqual(["วิสัยทัศน์"]);
  });

  it("computes the next order only within the selected parent", () => {
    expect(getNextSiblingOrder(order, null)).toBe(3);
    expect(getNextSiblingOrder(order, "menu-about")).toBe(3);
    expect(getNextSiblingOrder(order, "missing")).toBe(1);
  });

  it("moves only siblings under the same parent", () => {
    const moved = moveMenuSibling(order, "menu-vision", -1);
    expect(moved.find((item) => item.id === "menu-vision")?.order).toBe(1);
    expect(moved.find((item) => item.id === "menu-history")?.order).toBe(2);
    expect(moved.find((item) => item.id === "menu-about")?.order).toBe(1);
  });

  it("flattens compact order data into parent-first rows", () => {
    expect(flattenMenuOrder(order).map(({ item, depth }) => [item.id, depth])).toEqual([
      ["menu-about", 0],
      ["menu-history", 1],
      ["menu-vision", 1],
      ["menu-news", 0]
    ]);
  });

  it("detects order changes without depending on array order", () => {
    expect(orderIsDirty([...order].reverse(), order)).toBe(false);
    expect(
      orderIsDirty(
        order.map((item) => (item.id === "menu-news" ? { ...item, order: 1 } : item)),
        order
      )
    ).toBe(true);
  });
});
