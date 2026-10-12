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

/** Limit DOM/diagram width independently of the 5,000-node data validation ceiling. */
const MAX_RENDERED_DIAGRAM_UNITS = 500;

function UnitBranch({
  branch,
  positionsByUnit,
  media
}: {
  branch: PublicOrganizationUnitBranch;
  positionsByUnit: ReadonlyMap<string, readonly PublicOrganizationPosition[]>;
  media: Map<string, MediaAsset>;
}) {
  const { unit, children } = branch;
  const hasSiblings = children.length > 1;

  return (
    <Box
      component="li"
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: "0 0 auto",
        minWidth: 400,
        px: 1
      }}
    >
      <Box
        className="org-unit-head"
        sx={{
          position: "relative",
          "&::before": branch.level
            ? {
                content: '""',
                position: "absolute",
                bottom: "100%",
                left: "50%",
                height: 16,
                borderLeft: "2px solid",
                borderColor: "divider"
              }
            : {}
        }}
      >
        <Card
          variant="outlined"
          sx={{
            width: 228,
            minHeight: 118,
            borderRadius: 2,
            bgcolor: branch.level === 0 ? "action.hover" : "background.paper",
            borderColor: branch.level === 0 ? "primary.main" : "divider",
            flexShrink: 0
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
                sx={{
                  mt: 1,
                  whiteSpace: "pre-line",
                  overflowWrap: "anywhere",
                  textAlign: "center"
                }}
              >
                {unit.summary}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
      {(positionsByUnit.get(unit.contentId)?.length ?? 0) > 0 && (
        <Box sx={{ mt: 1.5, width: 376, maxWidth: "100%", minWidth: 0 }}>
          <OrganizationUnitPositionContent
            unit={unit}
            positions={positionsByUnit.get(unit.contentId) ?? []}
            media={media}
          />
        </Box>
      )}
      {children.length > 0 && (
        <Box
          component="ul"
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
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
              height: 16,
              borderLeft: "2px solid",
              borderColor: "divider"
            },
            "& > li::before, & > li::after": hasSiblings
              ? {
                  content: '""',
                  position: "absolute",
                  top: -16,
                  width: "50%",
                  borderTop: "2px solid",
                  borderColor: "divider"
                }
              : {},
            "& > li::before": hasSiblings ? { right: "50%" } : {},
            "& > li::after": hasSiblings ? { left: "50%" } : {},
            "& > li:first-of-type::before, & > li:last-of-type::after": { borderTop: 0 }
          }}
        >
          {children.map((child) => (
            <UnitBranch
              key={child.unit.contentId}
              branch={child}
              positionsByUnit={positionsByUnit}
              media={media}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Phase 3: render each unit’s saved A/B/cards positions within its own horizontal branch.
 * Units without positions remain visible; no extra requests or data writes.
 */
export default function OrganizationUnitHierarchyView({
  hierarchy,
  positionsByUnit = new Map(),
  media = new Map()
}: Props) {
  const renderable = hierarchy.root && hierarchy.includedUnitCount <= MAX_RENDERED_DIAGRAM_UNITS;

  return (
    <Stack component="section" spacing={1.5} aria-label="ผังโครงสร้างหน่วยงาน" sx={{ minWidth: 0, maxWidth: "100%" }}>
      <Typography variant="h2" sx={{ fontSize: "1.4rem", fontWeight: 700 }}>
        ผังโครงสร้างหน่วยงาน
      </Typography>
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
          <Typography variant="body2" color="text.secondary">
            เลื่อนแผนผังไปทางซ้ายหรือขวาเพื่อดูหน่วยงานทั้งหมด (รองรับการสัมผัสและแป้นพิมพ์)
          </Typography>
          <Box
            role="region"
            className="rcat-focus-ring"
            tabIndex={0}
            aria-label="ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้"
            sx={{
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
                <UnitBranch branch={hierarchy.root!} positionsByUnit={positionsByUnit} media={media} />
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Stack>
  );
}
