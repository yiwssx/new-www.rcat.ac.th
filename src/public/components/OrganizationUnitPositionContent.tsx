import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicOrganizationPosition, PublicOrganizationUnit } from "../../features/public-organization";
import type { MediaAsset } from "../../types";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";
import OrganizationChartView from "./OrganizationChartView";

function PositionGroup({
  position,
  media,
  showEducationQualifications
}: {
  position: PublicOrganizationPosition;
  showEducationQualifications: boolean;
  media: Map<string, MediaAsset>;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h3" sx={{ fontSize: "1.1rem", fontWeight: 700, overflowWrap: "anywhere" }}>
              {position.title}
            </Typography>
            {position.groupLabel && (
              <Typography variant="body2" color="text.secondary">
                {position.groupLabel}
              </Typography>
            )}
          </Box>
          {position.assignments.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              ยังไม่ได้ระบุผู้ดำรงตำแหน่ง
            </Typography>
          ) : (
            <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
              {position.assignments.map((assignment) => {
                const person = assignment.person;
                const portrait = person.photoMediaId ? media.get(person.photoMediaId) : undefined;
                return (
                  <Box
                    component="li"
                    key={assignment.id}
                    sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "flex-start", minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: { xs: 60, sm: 72 },
                        height: { xs: 60, sm: 72 },
                        borderRadius: 1.5,
                        overflow: "hidden",
                        bgcolor: "action.hover",
                        display: "grid",
                        placeItems: "center"
                      }}
                    >
                      {portrait?.type === "image" ? (
                        <PublicResponsiveImage
                          intent="content-body"
                          source={portrait}
                          alt={`ภาพของ${person.displayName}`}
                          width={72}
                          height={72}
                          aspectRatio="1 / 1"
                        />
                      ) : (
                        <BadgeOutlinedIcon color="disabled" sx={{ fontSize: 30 }} aria-hidden="true" />
                      )}
                    </Box>
                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{person.displayName}</Typography>
                      {assignment.dutyDetail && (
                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                          {assignment.dutyDetail}
                        </Typography>
                      )}
                      {person.employmentPosition && (
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                          {person.employmentPosition}
                        </Typography>
                      )}
                      {showEducationQualifications && person.educationQualifications && (
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-line" }}>
                          วุฒิการศึกษา: {person.educationQualifications}
                        </Typography>
                      )}
                      {person.publicEmail && (
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                          อีเมล: {person.publicEmail}
                        </Typography>
                      )}
                      {person.publicPhone && (
                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                          โทรศัพท์: {person.publicPhone}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

interface Props {
  unit: PublicOrganizationUnit;
  positions: readonly PublicOrganizationPosition[];
  media: Map<string, MediaAsset>;
}

/** Render one unit’s positions once, independent of the visual hierarchy of units. */
export default function OrganizationUnitPositionContent({ unit, positions, media }: Props) {
  if (positions.length === 0) return null;
  const showEducationQualifications = unit.unitKind === "department";
  return (
    <Box component="section" aria-label={"ตำแหน่งของ" + unit.title} sx={{ width: 376, maxWidth: "100%", minWidth: 0 }}>
      {unit.chartMode === "rows" || unit.chartMode === "tree" ? (
        <OrganizationChartView
          positions={[...positions]}
          layout={unit.chartLayout}
          media={media}
          showEducationQualifications={showEducationQualifications}
          mode={unit.chartMode}
        />
      ) : (
        <Box
          component="div"
          role="region"
          tabIndex={0}
          className="rcat-focus-ring"
          aria-label={"ตำแหน่งของ" + unit.title + " เลื่อนแนวนอนได้"}
          sx={{ maxWidth: "100%", minWidth: 0, overflowX: "auto", overscrollBehaviorX: "contain", pb: 1 }}
        >
          <Box sx={{ display: "flex", flexWrap: "nowrap", gap: 1.5, width: "max-content", minWidth: "100%" }}>
            {positions.map((position) => (
              <Box key={position.id} sx={{ flex: "0 0 244px", width: 244 }}>
                <PositionGroup
                  position={position}
                  media={media}
                  showEducationQualifications={showEducationQualifications}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
