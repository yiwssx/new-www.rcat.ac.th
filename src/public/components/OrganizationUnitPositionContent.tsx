import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import type { PublicOrganizationPosition, PublicOrganizationUnit } from "../../features/public-organization";
import type { MediaAsset } from "../../types";
import OrganizationChartView from "./OrganizationChartView";
import OrganizationPersonCard from "./OrganizationPersonCard";

interface Props {
  unit: PublicOrganizationUnit;
  positions: readonly PublicOrganizationPosition[];
  media: Map<string, MediaAsset>;
}

/** Each page owns its own unit's cards; the parent page controls aggregate scope. */
export default function OrganizationUnitPositionContent({ unit, positions, media }: Props) {
  if (positions.length === 0) return null;
  const showEducationQualifications = unit.unitKind === "department";
  return (
    <Box
      component="section"
      aria-label={"ตำแหน่งของ" + unit.title}
      sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
    >
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
          role="region"
          tabIndex={0}
          className="rcat-focus-ring"
          aria-label={"ตำแหน่งของ" + unit.title + " เลื่อนแนวนอนได้"}
          sx={{ maxWidth: "100%", minWidth: 0, overflowX: "auto", overscrollBehaviorX: "contain", pb: 1 }}
        >
          <Stack direction="row" spacing={1.5} sx={{ width: "max-content", minWidth: "100%", alignItems: "stretch" }}>
            {positions.flatMap((position) => {
              const assignments = position.assignments.length ? position.assignments : [null];
              return assignments.map((assignment, index) => (
                <OrganizationPersonCard
                  key={assignment?.id ?? position.id + "-" + index}
                  position={position}
                  assignment={assignment}
                  media={media}
                  showEducationQualifications={showEducationQualifications}
                />
              ));
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
