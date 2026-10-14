import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicOrganizationPosition } from "../../features/public-organization";
import type { MediaAsset } from "../../types";
import type {
  PublicOrganizationHierarchy,
  PublicOrganizationUnitBranch
} from "../../features/public-organization/hierarchy";
import OrganizationUnitPositionContent from "./OrganizationUnitPositionContent";

interface Props {
  hierarchy: PublicOrganizationHierarchy;
  positionsByUnit?: ReadonlyMap<string, readonly PublicOrganizationPosition[]>;
  media?: Map<string, MediaAsset>;
}

/** Independently bound the public DOM; the data model validates a larger ceiling. */
const MAX_RENDERED_DIAGRAM_UNITS = 500;

function UnitBranch({ branch }: { branch: PublicOrganizationUnitBranch }) {
  const { unit, children } = branch;

  return (
    <Box
      component="li"
      data-org-unit-id={unit.contentId}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: "0 0 auto",
        width: "max-content",
        minWidth: 228
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: 228,
          minHeight: 112,
          borderRadius: 2,
          bgcolor: branch.level === 0 ? "action.hover" : "background.paper",
          borderColor: branch.level === 0 ? "primary.main" : "divider"
        }}
      >
        <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
          <Typography
            component="div"
            variant="subtitle1"
            sx={{ fontWeight: 700, lineHeight: 1.4, textAlign: "center", overflowWrap: "anywhere" }}
          >
            <Link href={"/organization/" + encodeURIComponent(unit.slug)} underline="hover" color="inherit">
              {unit.title}
            </Link>
          </Typography>
          {unit.summary && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, whiteSpace: "pre-line", overflowWrap: "anywhere", textAlign: "center" }}
            >
              {unit.summary}
            </Typography>
          )}
        </CardContent>
      </Card>
      {children.length > 0 && (
        <Box
          component="ul"
          data-org-children-of={unit.contentId}
          sx={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 2,
            listStyle: "none",
            position: "relative",
            width: "max-content",
            minWidth: "100%",
            m: 0,
            p: 0,
            pt: 4,
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: "50%",
              height: 32,
              borderLeft: "2px solid",
              borderColor: "divider"
            }
          }}
        >
          {children.map((child) => (
            <UnitBranch key={child.unit.contentId} branch={child} />
          ))}
        </Box>
      )}
    </Box>
  );
}

/** Diagram cards are independent from the full-width personnel charts below. */
function chartUnits(branch: PublicOrganizationUnitBranch): PublicOrganizationUnitBranch[] {
  return [branch, ...branch.children.flatMap(chartUnits)];
}

export default function OrganizationUnitHierarchyView({
  hierarchy,
  positionsByUnit = new Map(),
  media = new Map()
}: Props) {
  const renderable = hierarchy.root && hierarchy.includedUnitCount <= MAX_RENDERED_DIAGRAM_UNITS;
  const positionedUnits = renderable
    ? chartUnits(hierarchy.root!).filter((branch) => (positionsByUnit.get(branch.unit.contentId)?.length ?? 0) > 0)
    : [];
  // A leaf page already names the selected unit above its personnel chart.
  const hasChildUnits = Boolean(hierarchy.root?.children.length);

  return (
    <Stack component="section" spacing={2} aria-label="ผังโครงสร้างหน่วยงาน" sx={{ minWidth: 0, maxWidth: "100%" }}>
      {renderable && hasChildUnits && (
        <Typography variant="h2" sx={{ fontSize: "1.4rem", fontWeight: 700 }}>
          ผังโครงสร้างหน่วยงาน
        </Typography>
      )}
      {hierarchy.excludedUnitCount > 0 && (
        <Typography variant="body2" color="text.secondary" role="status">
          มีหน่วยงานบางส่วนที่ไม่สามารถจัดเข้าลำดับชั้นที่เลือกได้
        </Typography>
      )}
      {!renderable ? (
        <Typography role="status" color="text.secondary">
          ไม่สามารถแสดงแผนผังได้เนื่องจากข้อมูลลำดับหน่วยงานไม่ครบถ้วนหรือมีจำนวนเกินขอบเขตการแสดงผล
          กรุณาเปิดหน้าหน่วยงานย่อยแยกต่างหาก
        </Typography>
      ) : (
        <>
          {hasChildUnits && (
            <>
          <Typography variant="body2" color="text.secondary">
            ผังแสดงหน่วยงานแม่ด้านบนและหน่วยงานลูกด้านล่าง หน่วยงานระดับเดียวกันอยู่ข้างกัน
          </Typography>
          <Box
            role="region"
            className="rcat-focus-ring"
            data-org-direction="top-down"
            tabIndex={0}
            aria-label="ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้"
            sx={{
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "thin",
              touchAction: "pan-x pan-y",
              overscrollBehaviorX: "contain",
              pb: 2,
              pt: 1
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "center", width: "max-content", minWidth: "100%" }}>
              <Box component="ul" sx={{ listStyle: "none", display: "flex", p: 0, m: 0 }}>
                <UnitBranch branch={hierarchy.root!} />
              </Box>
            </Box>
          </Box>
            </>
          )}
          {positionedUnits.length > 0 && (
            <Stack
              component="section"
              spacing={3}
              aria-label="ผังบุคลากรตามหน่วยงาน"
              sx={{ minWidth: 0, width: "100%" }}
            >
              {positionedUnits.map(({ unit }) => (
                <Box
                  component="section"
                  key={unit.contentId}
                  data-org-personnel-unit={unit.contentId}
                  aria-label={"ผังบุคลากร " + unit.title}
                  sx={{ width: "100%", minWidth: 0 }}
                >
                  {unit.contentId !== hierarchy.root!.unit.contentId && (
                    <Typography variant="h3" sx={{ fontSize: "1.15rem", fontWeight: 700, mb: 2 }}>
                      {unit.title}
                    </Typography>
                  )}
                  <OrganizationUnitPositionContent
                    unit={unit}
                    positions={positionsByUnit.get(unit.contentId) ?? []}
                    media={media}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
