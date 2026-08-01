import type { AdminMenuListItem, AdminMenuOrderItem } from "../../features/admin-pagination";
import type { PublicMenuItem } from "../../features/cms-navigation/types";

export type MenuVisibilityFilter = "all" | "enabled" | "disabled";

export interface PublicMenuRow {
  item: PublicMenuItem;
  depth: number;
  parentLabel: string | null;
}

export interface ParentMenuOption {
  id: string;
  label: string;
  depth: number;
}

export function normalizeMenuHref(value: string) {
  const raw = value.trim();

  if (!raw) {
    return "/";
  }

  if (/^(https?:\/\/|mailto:|tel:)/i.test(raw) || raw.startsWith("#")) {
    return raw;
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

function menuSiblingSort(left: AdminMenuListItem, right: AdminMenuListItem) {
  return left.order - right.order || left.label.localeCompare(right.label, "th");
}

export function buildMenuTree(items: readonly AdminMenuListItem[]): PublicMenuItem[] {
  const rowsById = new Map(items.map((item) => [item.id, item]));
  const byParent = new Map<string | null, AdminMenuListItem[]>();

  items.forEach((item) => {
    const normalizedParent =
      item.parentId && item.parentId !== item.id && rowsById.has(item.parentId) ? item.parentId : null;
    const siblings = byParent.get(normalizedParent) ?? [];
    siblings.push(item);
    byParent.set(normalizedParent, siblings);
  });

  byParent.forEach((siblings) => siblings.sort(menuSiblingSort));

  const emitted = new Set<string>();

  const buildNode = (item: AdminMenuListItem, ancestors: ReadonlySet<string>): PublicMenuItem => {
    emitted.add(item.id);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(item.id);

    const children = (byParent.get(item.id) ?? [])
      .filter((child) => !nextAncestors.has(child.id))
      .map((child) => buildNode(child, nextAncestors));

    return {
      id: item.id,
      label: item.label,
      href: item.href,
      enabled: item.enabled,
      ...(children.length ? { children } : {})
    };
  };

  const roots: PublicMenuItem[] = [];

  (byParent.get(null) ?? []).forEach((item) => {
    if (!emitted.has(item.id)) {
      roots.push(buildNode(item, new Set()));
    }
  });

  [...items].sort(menuSiblingSort).forEach((item) => {
    if (!emitted.has(item.id)) {
      roots.push(buildNode(item, new Set()));
    }
  });

  return roots;
}

export function flattenPublicMenu(
  items: readonly PublicMenuItem[],
  depth = 0,
  parentLabel: string | null = null
): PublicMenuRow[] {
  return items.flatMap((item) => [
    { item, depth, parentLabel },
    ...flattenPublicMenu(item.children ?? [], depth + 1, item.label)
  ]);
}

export function filterMenuTree(
  items: readonly PublicMenuItem[],
  query: string,
  visibility: MenuVisibilityFilter
): PublicMenuItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");

  return items.flatMap((item) => {
    const filteredChildren = filterMenuTree(item.children ?? [], query, visibility);
    const visibilityMatches = visibility === "all" || (visibility === "enabled" ? item.enabled : !item.enabled);
    const textMatches =
      !normalizedQuery ||
      item.label.toLocaleLowerCase("th-TH").includes(normalizedQuery) ||
      item.href.toLocaleLowerCase("th-TH").includes(normalizedQuery);
    const itemMatches = visibilityMatches && textMatches;

    if (!itemMatches && filteredChildren.length === 0) {
      return [];
    }

    return [
      {
        ...item,
        ...(filteredChildren.length ? { children: filteredChildren } : { children: undefined })
      }
    ];
  });
}

export function parentMenuOptions(items: readonly PublicMenuItem[]): ParentMenuOption[] {
  return flattenPublicMenu(items).map(({ item, depth }) => ({ id: item.id, label: item.label, depth }));
}

export function getNextSiblingOrder(items: readonly AdminMenuOrderItem[], parentId: string | null) {
  const siblingOrders = items.filter((item) => item.parentId === parentId).map((item) => item.order);
  return (siblingOrders.length ? Math.max(...siblingOrders) : 0) + 1;
}

export function orderSnapshot(items: readonly AdminMenuOrderItem[]) {
  return items
    .map(({ id, parentId, order, enabled, revision }) => ({ id, parentId, order, enabled, revision }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function orderIsDirty(current: readonly AdminMenuOrderItem[], source: readonly AdminMenuOrderItem[]) {
  return JSON.stringify(orderSnapshot(current)) !== JSON.stringify(orderSnapshot(source));
}

export function moveMenuSibling(items: AdminMenuOrderItem[], id: string, direction: -1 | 1) {
  const current = items.find((item) => item.id === id);

  if (!current) {
    return items;
  }

  const siblings = items
    .filter((item) => item.parentId === current.parentId)
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
  const index = siblings.findIndex((item) => item.id === id);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) {
    return items;
  }

  const nextSiblings = [...siblings];
  const [moved] = nextSiblings.splice(index, 1);

  if (!moved) {
    return items;
  }

  nextSiblings.splice(nextIndex, 0, moved);
  const nextOrderById = new Map(nextSiblings.map((item, itemIndex) => [item.id, itemIndex + 1]));

  return items.map((item) =>
    item.parentId === current.parentId ? { ...item, order: nextOrderById.get(item.id) ?? item.order } : item
  );
}

export function flattenMenuOrder(items: readonly AdminMenuOrderItem[]) {
  const byParent = new Map<string | null, AdminMenuOrderItem[]>();

  items.forEach((item) => {
    const siblings = byParent.get(item.parentId) ?? [];
    siblings.push(item);
    byParent.set(item.parentId, siblings);
  });

  byParent.forEach((siblings) =>
    siblings.sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
  );

  const rows: Array<{ item: AdminMenuOrderItem; depth: number }> = [];
  const visited = new Set<string>();

  const visit = (parentId: string | null, depth: number) => {
    (byParent.get(parentId) ?? []).forEach((item) => {
      if (visited.has(item.id)) {
        return;
      }

      visited.add(item.id);
      rows.push({ item, depth });
      visit(item.id, depth + 1);
    });
  };

  visit(null, 0);

  items.forEach((item) => {
    if (!visited.has(item.id)) {
      rows.push({ item, depth: 0 });
    }
  });

  return rows;
}
