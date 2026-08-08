import { describe, expect, it } from "vitest";
import { createPublicMetadata } from "../src/adapters/publicMetadataAdapter";
import type { PublicMetadataRows } from "../src/db/publicMetadataRepository";
import type { MenuItemRow } from "../src/db/schema";

function menuRow(overrides: Partial<MenuItemRow> & Pick<MenuItemRow, "id" | "label">): MenuItemRow {
  return {
    id: overrides.id,
    parent_id: overrides.parent_id ?? "",
    label: overrides.label,
    href: overrides.href ?? `/${overrides.id}`,
    enabled: overrides.enabled ?? 1,
    sort_order: overrides.sort_order ?? 0,
    children_json: overrides.children_json ?? "[]",
    updated_at: overrides.updated_at ?? "2026-08-08T00:00:00.000Z"
  };
}

function metadataRows(menu: MenuItemRow[]): PublicMetadataRows {
  return {
    siteSettings: null,
    homepageSettings: null,
    displaySettings: null,
    menu,
    media: [],
    carouselSlides: [],
    externalServices: [],
    events: []
  };
}

describe("public menu visibility hierarchy", () => {
  it("keeps enabled children nested under an available parent", () => {
    const metadata = createPublicMetadata(
      metadataRows([
        menuRow({ id: "parent", label: "Parent" }),
        menuRow({ id: "child", label: "Child", parent_id: "parent" })
      ])
    );

    expect(metadata.menu).toHaveLength(1);
    expect(metadata.menu[0]?.id).toBe("parent");
    expect(metadata.menu[0]?.children?.map((item) => item.id)).toEqual(["child"]);
  });

  it("does not promote an enabled child to a root when its hidden parent is absent", () => {
    const metadata = createPublicMetadata(
      metadataRows([menuRow({ id: "child", label: "Child", parent_id: "hidden-parent" })])
    );

    expect(metadata.menu).toEqual([]);
  });

  it("keeps an entire descendant branch hidden when an ancestor is absent", () => {
    const metadata = createPublicMetadata(
      metadataRows([
        menuRow({ id: "child", label: "Child", parent_id: "hidden-parent" }),
        menuRow({ id: "grandchild", label: "Grandchild", parent_id: "child" })
      ])
    );

    expect(metadata.menu).toEqual([]);
  });
});
