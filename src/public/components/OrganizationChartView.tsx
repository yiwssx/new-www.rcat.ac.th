import { useMemo, type ReactNode } from "react";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { chartPlacement, type OrganizationChartLayout } from "../../../shared/organizationChartLayout";
import type { MediaAsset } from "../../types";
import type { PublicOrganizationPosition } from "../../features/public-organization";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";

interface Props {
  positions: PublicOrganizationPosition[];
  layout?: OrganizationChartLayout;
  media: Map<string, MediaAsset>;
  showEducationQualifications: boolean;
  mode: "rows" | "tree";
}

function PeopleCard({
  position,
  media,
  showEducationQualifications
}: Pick<Props, "media" | "showEducationQualifications"> & { position: PublicOrganizationPosition }) {
  return (
    <Card variant="outlined" sx={{ width: 194, flexShrink: 0, borderRadius: 2, height: "100%" }}>
      <CardContent sx={{ textAlign: "center", p: 1.5, "&:last-child": { pb: 1.5 } }}>
        {position.assignments.length === 0 ? (
          <Box sx={{ py: 2 }}>
            <BadgeOutlinedIcon color="disabled" sx={{ fontSize: 40 }} />
            <Typography variant="body2" color="text.secondary">
              ยังไม่มีผู้ดำรงตำแหน่ง
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {position.assignments.map(({ id, person, dutyDetail }) => {
              const asset = person.photoMediaId ? media.get(person.photoMediaId) : undefined;
              return (
                <Stack key={id} spacing={0.5} sx={{ alignItems: "center" }}>
                  <Box
                    sx={{
                      width: 94,
                      height: 115,
                      borderRadius: 1,
                      overflow: "hidden",
                      bgcolor: "action.hover",
                      display: "grid",
                      placeItems: "center"
                    }}
                  >
                    {asset?.type === "image" ? (
                      <PublicResponsiveImage
                        intent="content-body"
                        source={asset}
                        alt={`ภาพของ${person.displayName}`}
                        width={94}
                        height={115}
                        aspectRatio="94 / 115"
                      />
                    ) : (
                      <BadgeOutlinedIcon color="disabled" sx={{ fontSize: 40 }} aria-hidden="true" />
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                    {person.displayName}
                  </Typography>
                  {dutyDetail && (
                    <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
                      {dutyDetail}
                    </Typography>
                  )}
                  {person.employmentPosition && (
                    <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
                      {person.employmentPosition}
                    </Typography>
                  )}
                  {showEducationQualifications && person.educationQualifications && (
                    <Typography variant="caption" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-line" }}>
                      วุฒิการศึกษา: {person.educationQualifications}
                    </Typography>
                  )}
                  {person.publicEmail && (
                    <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
                      {person.publicEmail}
                    </Typography>
                  )}
                  {person.publicPhone && <Typography variant="caption">{person.publicPhone}</Typography>}
                </Stack>
              );
            })}
          </Stack>
        )}
        <Typography variant="body2" sx={{ fontWeight: 700, mt: 1, overflowWrap: "anywhere" }}>
          {position.title}
        </Typography>
        {position.groupLabel && (
          <Typography variant="caption" color="text.secondary">
            {position.groupLabel}
          </Typography>
        )}
      </CardContent>
    </Card>
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
      <Stack spacing={3} aria-label="ผังบุคลากรแบบระดับและแถว">
        {rows.map((group) => (
          <Box key={group.key} component="section" aria-label={`ระดับ ${group.level} แถว ${group.row}`}>
            <Typography variant="h3" sx={{ fontSize: "1rem", fontWeight: 700, textAlign: "center", mb: 1.5 }}>
              ระดับ {group.level}
              {group.row > 1 ? ` · แถว ${group.row}` : ""}
            </Typography>
            <Box
              sx={{ overflowX: "auto", maxWidth: "100%", pb: 1 }}
              tabIndex={0}
              role="region"
              aria-label={`แถวระดับ ${group.level} แถว ${group.row} เลื่อนแนวนอนได้`}
            >
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "nowrap",
                  justifyContent: "center",
                  alignItems: "stretch",
                  width: "max-content",
                  minWidth: "100%",
                  gap: 2
                }}
              >
                {group.positions.map((position) => (
                  <PeopleCard
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
          listStyle: "none",
          justifyContent: "center",
          position: "relative",
          width: "max-content",
          minWidth: "100%",
          p: 0,
          m: 0,
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
            : {},
          "& > li::before, & > li::after": parentId
            ? {
                content: '""',
                position: "absolute",
                top: 0,
                width: "50%",
                borderTop: "2px solid",
                borderColor: "divider"
              }
            : {},
          "& > li::before": { right: "50%" },
          "& > li::after": { left: "50%" },
          "& > li:first-of-type::before, & > li:last-of-type::after": { borderTop: "none" },
          "& > li:only-child::before, & > li:only-child::after": { borderTop: "none" }
        }}
      >
        {siblings.map((position) => {
          if (ancestors.has(position.id)) return null;
          const next = new Set(ancestors);
          next.add(position.id);
          return (
            <Box
              component="li"
              key={position.id}
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
                px: 1,
                minWidth: 210
              }}
            >
              <PeopleCard position={position} media={media} showEducationQualifications={showEducationQualifications} />
              {branch(position.id, next)}
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
      aria-label="ผังสายบังคับบัญชา เลื่อนแนวนอนเพื่อดูตำแหน่งทั้งหมด"
      sx={{ maxWidth: "100%", overflowX: "auto", pb: 2, outlineOffset: 2 }}
    >
      <Box sx={{ width: "max-content", minWidth: "100%" }}>{branch(null, new Set())}</Box>
    </Box>
  );
}
