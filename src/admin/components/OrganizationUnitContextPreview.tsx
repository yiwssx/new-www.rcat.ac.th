import { useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { OrganizationUnitListRow } from "../../features/organization-admin";

interface Props {
  selected: OrganizationUnitListRow;
  units: readonly OrganizationUnitListRow[];
  allUnitsLoaded: boolean;
  onSelect: (unit: OrganizationUnitListRow) => void;
}

import { focusedUnitContext } from "./organizationUnitContextModel";

const statusLabel: Record<OrganizationUnitListRow["status"], string> = {
  draft: "ฉบับร่าง",
  review: "รอตรวจทาน",
  scheduled: "รอเผยแพร่",
  published: "เผยแพร่แล้ว"
};

function ContextNode({
  unit,
  selected,
  onSelect
}: {
  unit: OrganizationUnitListRow;
  selected: boolean;
  onSelect: (unit: OrganizationUnitListRow) => void;
}) {
  return (
    <Box component="li" sx={{ listStyle: "none", flex: "0 0 208px", minWidth: 0 }}>
      <Button
        fullWidth
        variant={selected ? "contained" : "outlined"}
        onClick={() => onSelect(unit)}
        aria-current={selected ? "true" : undefined}
        sx={{
          py: 1.5,
          px: 1.25,
          minHeight: 94,
          flexDirection: "column",
          justifyContent: "center",
          textAlign: "center",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          gap: 0.5
        }}
      >
        <Typography component="span" variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
          {unit.title}
        </Typography>
        <Typography component="span" variant="caption" sx={{ overflowWrap: "anywhere" }}>
          {selected ? "หน่วยงานที่กำลังแก้ไข" : statusLabel[unit.status]}
        </Typography>
      </Button>
    </Box>
  );
}

/** Shows the local parent + loaded sibling context without downloading the whole organization. */
export default function OrganizationUnitContextPreview({ selected, units, allUnitsLoaded, onSelect }: Props) {
  const context = useMemo(() => focusedUnitContext(selected, units), [selected, units]);
  const root = context.parent ?? selected;
  const children = context.parent
    ? context.peers
    : units
        .filter((unit) => unit.parent_content_id === selected.content_id && unit.content_id !== selected.content_id)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            a.title.localeCompare(b.title, "th") ||
            a.content_id.localeCompare(b.content_id)
        );

  return (
    <Stack component="section" aria-label="ตัวอย่างลำดับชั้นหน่วยงาน" spacing={1.5} sx={{ minWidth: 0 }}>
      <Typography variant="h3" sx={{ fontSize: "1.1rem", fontWeight: 700 }}>
        1. ผังหน่วยงาน — ความสัมพันธ์ระหว่างฝ่าย งาน และแผนก
      </Typography>
      <Typography variant="body2" color="text.secondary">
        ผังหน่วยงานแสดงหน่วยงานแม่ไว้ด้านบน และหน่วยงานระดับเดียวกันเรียงแนวนอนด้านล่าง ส่วนรูปแบบ A/B ใช้จัดตำแหน่งบุคลากรภายในหน่วยงานที่เลือก
      </Typography>
      {(!allUnitsLoaded || context.missingParent) && (
        <Alert severity="info" role="status">
          แสดงเฉพาะหน่วยงานที่โหลดแล้ว{context.missingParent ? " (ยังไม่โหลดหน่วยงานแม่)" : ""} —
          ค้นหาและเลือกหน่วยงานอื่นได้ทันที ไม่ต้องโหลดเกิน 100 รายการก่อนจัดผัง
        </Alert>
      )}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Chip size="small" label={"สถานะ: " + statusLabel[selected.status]} variant="outlined" />
        <Chip size="small" label={"Revision: " + selected.unit_revision} variant="outlined" />
        <Chip size="small" label={"หน่วยงานระดับเดียวกันที่โหลด: " + context.peers.length} variant="outlined" />
      </Stack>
      <Box
        role="region"
        tabIndex={0}
        className="rcat-focus-ring"
        aria-label="ตัวอย่างผังหน่วยงานจากบนลงล่าง เลื่อนแนวนอนเพื่อดูหน่วยงานระดับเดียวกัน"
        data-org-direction="top-down"
        sx={{ maxWidth: "100%", minWidth: 0, overflowX: "auto", overscrollBehaviorX: "contain", pb: 2, pt: 1 }}
      >
        <Stack
          direction="column"
          sx={{ width: "max-content", minWidth: "100%", alignItems: "center", px: 1 }}
        >
          <Box component="ul" data-org-level="parent" sx={{ p: 0, m: 0, display: "flex", justifyContent: "center" }}>
            <ContextNode unit={root} selected={root.content_id === selected.content_id} onSelect={onSelect} />
          </Box>
          {children.length > 0 && (
            <>
              <Box
                aria-hidden="true"
                sx={{ height: 20, borderLeft: "2px solid", borderColor: "divider" }}
              />
              <Box
                component="ul"
                data-org-level="peers"
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  position: "relative",
                  gap: 1.5,
                  m: 0,
                  p: 0,
                  pt: 3,
                  "&::before":
                    children.length > 1
                      ? {
                          content: '""',
                          position: "absolute",
                          top: 0,
                          left: 104,
                          right: 104,
                          borderTop: "2px solid",
                          borderColor: "divider"
                        }
                      : undefined,
                  "& > li": {
                    position: "relative",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: -24,
                      left: "50%",
                      height: 24,
                      borderLeft: "2px solid",
                      borderColor: "divider"
                    }
                  }
                }}
              >
                {children.map((unit) => (
                  <ContextNode
                    key={unit.content_id}
                    unit={unit}
                    selected={unit.content_id === selected.content_id}
                    onSelect={onSelect}
                  />
                ))}
              </Box>
            </>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
