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
        แผนผังหน่วยงานไล่จากแม่ทางซ้ายไปหาลูกทางขวา ส่วนรูปแบบ A/B ด้านล่างใช้จัดตำแหน่งบุคลากรภายในหน่วยงานนั้นเท่านั้น
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
        aria-label="ตัวอย่างความสัมพันธ์หน่วยงานแนวนอน เลื่อนดูได้"
        sx={{ maxWidth: "100%", minWidth: 0, overflowX: "auto", overscrollBehaviorX: "contain", pb: 2, pt: 1 }}
      >

        <Stack direction="row" sx={{ minWidth: "max-content", alignItems: "flex-start", px: 1 }}>
          <Box component="ul" sx={{ p: 0, m: 0, display: "flex" }}>
            <ContextNode unit={root} selected={root.content_id === selected.content_id} onSelect={onSelect} />
          </Box>
          {children.length > 0 && (
            <>
              <Box
                aria-hidden="true"
                sx={{ alignSelf: "flex-start", mt: "46px", width: 32, borderTop: "2px solid", borderColor: "divider" }}
              />
              <Box
                component="ul"
                sx={{
                  display: "flex",
                  justifyContent: "flex-start",
                  position: "relative",
                  gap: 1.5,
                  m: 0,
                  p: 0,
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 46,
                    left: 0,
                    right: 0,
                    borderTop: "2px solid",
                    borderColor: "divider",
                    zIndex: 0
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
        </Stack>>
      </Box>
    </Stack>
  );
}
