/** Visual placement is per unit and independent of employment rank and position group. */
export type OrganizationChartMode = "cards" | "rows" | "tree";

export interface OrganizationChartPlacement {
  level: number;
  row: number;
  order: number;
  parentPositionId: string | null;
}

export type OrganizationChartLayout = Record<string, OrganizationChartPlacement>;

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function parseOrganizationChartLayout(input: unknown): OrganizationChartLayout {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("invalid chartLayout");
  }
  const source = input as Record<string, unknown>;
  if (Object.keys(source).length > 500) throw new Error("chartLayout exceeds 500 positions");
  const layout: OrganizationChartLayout = Object.create(null) as OrganizationChartLayout;
  for (const [id, raw] of Object.entries(source)) {
    if (!ID.test(id) || !raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("invalid chart position");
    }
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).some((key) => !["level", "row", "order", "parentPositionId"].includes(key))) {
      throw new Error("unexpected chart position field");
    }
    for (const key of ["level", "row", "order"] as const) {
      const value = item[key];
      const max = key === "order" ? 1000000 : 100;
      const min = key === "order" ? 0 : 1;
      if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
        throw new Error(`invalid chart ${key}`);
      }
    }
    const parent = item.parentPositionId;
    if (parent !== null && (typeof parent !== "string" || !ID.test(parent))) {
      throw new Error("invalid parentPositionId");
    }
    layout[id] = {
      level: item.level as number,
      row: item.row as number,
      order: item.order as number,
      parentPositionId: parent
    };
  }
  for (const [id, placement] of Object.entries(layout)) {
    if (!placement.parentPositionId) continue;
    const parent = layout[placement.parentPositionId];
    if (!parent || parent.level >= placement.level || placement.parentPositionId === id) {
      throw new Error("chart reporting relationship must point to a higher level in the same chart");
    }
  }
  return layout;
}

export function chartPlacement(
  layout: OrganizationChartLayout | undefined,
  position: { id: string; groupSortOrder: number; sortOrder: number }
): OrganizationChartPlacement {
  return layout?.[position.id] ?? {
    level: Math.min(100, Math.max(1, position.groupSortOrder + 1)),
    row: 1,
    order: position.sortOrder,
    parentPositionId: null
  };
}
