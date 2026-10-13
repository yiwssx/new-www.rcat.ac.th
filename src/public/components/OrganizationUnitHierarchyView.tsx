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

  return (
    <Box
      component="li"
      data-org-unit-id={unit.contentId}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        flex: "0 0 auto",
        width: "max-content",
        minWidth: "max-content",
        // Every parent -> child step advances on the X axis, even for a one-child chain.
        // Child branches stay on a single horizontal rail instead of forming a vertical stack.
        "&::before": branch.level
          ? {
              content: '""',
              position: "absolute",
              top: 58,
              left: -28,
              width: 114,
              borderTop: "2px solid",
              borderColor: "divider"
            }
          : {}
      }}
    >
      <Box
        sx={{
          width: 400,
          minWidth: 400,
          px: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}
      >
        <Box
          className="org-unit-head"
          sx={{
            position: "relative",
            // Rightward connection from this unit to the first level of its child branches.
            "&::after": children.length
              ? {
                  content: '""',
                  position: "absolute",
                  left: "100%",
                  top: 58,
                  width: 114,
                  borderTop: "2px solid",
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
                  sx={{ mt: 1, whiteSpace: "pre-line", overflowWrap: "anywhere", textAlign: "center" }}
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
      </Box>
      {children.length > 0 && (
        <Box
          component="ul"
          data-org-children-of={unit.contentId}
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            listStyle: "none",
            position: "relative",
            width: "max-content",
            minWidth: "max-content",
            m: 0,
            p: 0,
            pl: 3.5,
            // A horizontal connecting rail is intentionally behind the opaque cards.
            // Unlike the old vertical model, nodes at increasing depth advance to the right.
            "&::before": {
              content: '""',
              position: "absolute",
              top: 58,
              left: 0,
              right: 0,
              borderTop: "2px solid",
              borderColor: "divider",
              zIndex: 0
            }
          }}
        >
          {children.map((child) => (
            <UnitBranch key={child.unit.contentId} branch={child} positionsByUnit={positionsByUnit} media={media} />
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
            ผังไล่จากหน่วยงานแม่ทางซ้ายไปหาหน่วยงานลูกทางขวา เลื่อนในกรอบผังเพื่อดูส่วนที่เหลือ
          </Typography>
          <Box
            role="region"
            className="rcat-focus-ring"
            data-org-direction="left-to-right"
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
            <Box sx={{ display: "flex", justifyContent: "flex-start", width: "max-content", minWidth: "100%" }}>
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
