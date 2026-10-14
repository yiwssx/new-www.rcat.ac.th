import { useMemo, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { chartPlacement, type OrganizationChartLayout } from "../../../shared/organizationChartLayout";
import type { MediaAsset } from "../../types";
import type { PublicOrganizationPosition } from "../../features/public-organization";
import OrganizationPersonCard from "./OrganizationPersonCard";

interface Props {
  positions: PublicOrganizationPosition[];
  layout?: OrganizationChartLayout;
  media: Map<string, MediaAsset>;
  showEducationQualifications: boolean;
  mode: "rows" | "tree";
}

/**
 * One position may have several personnel assignments. Render them as adjacent
 * portrait cards; otherwise a single "teacher" slot becomes an endless vertical
 * column even when the hierarchy itself is correctly top-down.
 */
function PositionCards({
  position,
  media,
  showEducationQualifications
}: Pick<Props, "media" | "showEducationQualifications"> & { position: PublicOrganizationPosition }) {
  const cards = position.assignments.length
    ? position.assignments.map((assignment) => ({ ...position, assignments: [assignment] }))
    : [position];

  return (
    <Box
      data-org-position-cards={position.id}
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        justifyContent: "center",
        gap: 2,
        width: "max-content"
      }}
    >
      {cards.map((card) => (
        <OrganizationPersonCard
          key={card.assignments[0]?.id ?? position.id}
          position={position}
          assignment={card.assignments[0] ?? null}
          media={media}
          showEducationQualifications={showEducationQualifications}
        />
      ))}
    </Box>
  );
}

export default function OrganizationChartView({ positions, layout, media, showEducationQualifications, mode }: Props) {
  const sorted = useMemo(
    () =>
      [...positions].sort((a, b) => {
        const aa = chartPlacement(layout, a);
        const bb = chartPlacement(layout, b);
        return aa.level - bb.level || aa.row - bb.row || aa.order - bb.order || a.id.localeCompare(b.id);
      }),
    [layout, positions]
  );

  const rows = useMemo(() => {
    const result: { key: string; level: number; row: number; positions: PublicOrganizationPosition[] }[] = [];
    for (const position of sorted) {
      const placement = chartPlacement(layout, position);
      const key = `${placement.level}:${placement.row}`;
      const current = result[result.length - 1];
      if (current?.key === key) current.positions.push(position);
      else result.push({ key, level: placement.level, row: placement.row, positions: [position] });
    }
    return result;
  }, [layout, sorted]);

  if (mode === "rows") {
    return (
      <Box
        role="region"
        tabIndex={0}
        className="rcat-focus-ring"
        data-org-position-flow="top-down"
        aria-label="ผังบุคลากรแบบระดับและแถว เลื่อนแนวนอนได้"
        sx={{ width: "100%", minWidth: 0, maxWidth: "100%", overflowX: "auto", pb: 2, overscrollBehaviorX: "contain" }}
      >
        <Stack spacing={0} sx={{ alignItems: "center", width: "max-content", minWidth: "100%" }}>
          {rows.map((group, index) => (
            <Box
              key={group.key}
              component="section"
              aria-label={`ระดับ ${group.level} แถว ${group.row}`}
              data-org-level={group.level}
              sx={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 210 }}
            >
              {index > 0 && (
                <Box aria-hidden="true" sx={{ height: 32, borderLeft: "2px solid", borderColor: "divider" }} />
              )}
              <Box
                role="region"
                tabIndex={0}
                className="rcat-focus-ring"
                aria-label={`แถวระดับ ${group.level} แถว ${group.row} เลื่อนแนวนอนได้`}
                sx={{ maxWidth: "100%", minWidth: 0, pb: 1 }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 2,
                    alignItems: "stretch",
                    width: "max-content"
                  }}
                >
                  {group.positions.map((position) => (
                    <PositionCards
                      key={position.id}
                      position={position}
                      media={media}
                      showEducationQualifications={showEducationQualifications}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  }

  const byParent = new Map<string | null, PublicOrganizationPosition[]>();
  const ids = new Set(sorted.map((position) => position.id));
  for (const position of sorted) {
    const parent = chartPlacement(layout, position).parentPositionId;
    const target = parent && ids.has(parent) ? parent : null;
    const siblings = byParent.get(target) ?? [];
    siblings.push(position);
    byParent.set(target, siblings);
  }

  function branch(parentId: string | null, ancestors: Set<string>): ReactNode {
    const siblings = byParent.get(parentId) ?? [];
    if (!siblings.length) return null;
    return (
      <Box
        component="ul"
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "flex-start",
          position: "relative",
          listStyle: "none",
          width: "max-content",
          minWidth: "100%",
          gap: 2,
          m: 0,
          p: 0,
          pt: parentId ? 3 : 0,
          "&::before": parentId
            ? {
                content: '""',
                position: "absolute",
                top: 0,
                left: "50%",
                height: 24,
                borderLeft: "2px solid",
                borderColor: "divider"
              }
            : {}
        }}
      >
        {siblings.map((position) => {
          if (ancestors.has(position.id)) return null;
          const next = new Set(ancestors);
          next.add(position.id);
          const hasChildren = (byParent.get(position.id)?.length ?? 0) > 0;
          return (
            <Box
              component="li"
              key={position.id}
              data-org-position-id={position.id}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                minWidth: 210,
                "&::before":
                  parentId && siblings.length > 1
                    ? {
                        content: '""',
                        position: "absolute",
                        top: -24,
                        left: "50%",
                        height: 24,
                        borderLeft: "2px solid",
                        borderColor: "divider"
                      }
                    : {}
              }}
            >
              <PositionCards
                position={position}
                media={media}
                showEducationQualifications={showEducationQualifications}
              />
              {hasChildren && branch(position.id, next)}
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box
      role="region"
      tabIndex={0}
      className="rcat-focus-ring"
      data-org-position-flow="top-down"
      aria-label="ผังสายบังคับบัญชา เลื่อนแนวนอนเพื่อดูตำแหน่งทั้งหมด"
      sx={{
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        overflowX: "auto",
        pb: 2,
        outlineOffset: 2,
        overscrollBehaviorX: "contain"
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "center", width: "max-content", minWidth: "100%" }}>
        {branch(null, new Set())}
      </Box>
    </Box>
  );
}
