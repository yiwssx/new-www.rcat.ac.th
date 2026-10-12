import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  chartPlacement,
  parseOrganizationChartLayout,
  type OrganizationChartLayout,
  type OrganizationChartMode
} from "../../../shared/organizationChartLayout";
import {
  updateOrganizationRecord,
  type OrganizationAssignmentRow,
  type OrganizationPersonnelRow,
  type OrganizationPositionRow,
  type OrganizationUnitListRow
} from "../../features/organization-admin";
import type { PublicOrganizationPosition } from "../../features/public-organization";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import OrganizationChartView from "../../public/components/OrganizationChartView";

interface Props {
  unit: OrganizationUnitListRow;
  positions: OrganizationPositionRow[];
  assignments: OrganizationAssignmentRow[];
  personnel: OrganizationPersonnelRow[];
  canManage: boolean;
  allPositionsLoaded: boolean;
  onSaved: () => Promise<void>;
}

function parseInitial(value: string | undefined): OrganizationChartLayout {
  try {
    return parseOrganizationChartLayout(JSON.parse(value || "{}"));
  } catch {
    return {};
  }
}

export default function OrganizationChartLayoutEditor({
  unit,
  positions,
  assignments,
  personnel,
  canManage,
  allPositionsLoaded,
  onSaved
}: Props) {
  const [mode, setMode] = useState<OrganizationChartMode>(unit.chart_mode ?? "cards");
  const [layout, setLayout] = useState<OrganizationChartLayout>(() => {
    const saved = parseInitial(unit.chart_layout);
    return Object.fromEntries(
      positions.map((position) => [
        position.id,
        chartPlacement(saved, {
          id: position.id,
          groupSortOrder: position.group_sort_order,
          sortOrder: position.sort_order
        })
      ])
    );
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedMode, setSavedMode] = useState(unit.chart_mode ?? "cards");
  const byPerson = useMemo(() => new Map(personnel.map((item) => [item.id, item])), [personnel]);

  const previewPositions = useMemo<PublicOrganizationPosition[]>(
    () =>
      positions.map((position) => ({
        id: position.id,
        unitContentId: position.unit_content_id,
        title: position.title,
        groupLabel: position.group_label,
        groupSortOrder: position.group_sort_order,
        sortOrder: position.sort_order,
        displayStyle: position.display_style,
        assignments: assignments
          .filter((assignment) => assignment.position_id === position.id && assignment.enabled === 1)
          .flatMap((assignment) => {
            const person = byPerson.get(assignment.personnel_id);
            if (!person || person.active !== 1) return [];
            return [
              {
                id: assignment.id,
                dutyDetail: assignment.duty_detail,
                sortOrder: assignment.sort_order,
                person: {
                  id: person.id,
                  displayName: person.display_name,
                  personnelType: person.personnel_type,
                  employmentPosition: person.employment_position,
                  educationQualifications: person.education_qualifications,
                  photoMediaId: person.photo_media_id,
                  publicEmail: person.show_public_email === 1 ? person.public_email : "",
                  publicPhone: person.show_public_phone === 1 ? person.public_phone : ""
                }
              }
            ];
          })
      })),
    [positions, assignments, byPerson]
  );

  function patch(id: string, key: "level" | "row" | "order" | "parentPositionId", value: number | string | null) {
    setLayout((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value }
    }));
    setError("");
  }

  function adjustPlacement(id: string, field: "level" | "row" | "order", delta: number, current: number) {
    const min = field === "order" ? 0 : 1;
    const max = field === "order" ? 1000000 : 100;
    patch(id, field, Math.max(min, Math.min(max, current + delta)));
  }

  async function save() {
    if (busy || !canManage || !allPositionsLoaded) return;
    let validated: OrganizationChartLayout;
    try {
      validated = parseOrganizationChartLayout(layout);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "การจัดวางไม่ถูกต้อง");
      return;
    }
    setBusy(true);
    setError("");
    showBlockingLoading("กำลังบันทึกผังองค์กร");
    try {
      await updateOrganizationRecord("units", unit.content_id, unit.unit_revision, {
        chartMode: mode,
        chartLayout: validated
      });
      await onSaved();
      setSavedMode(mode);
      await appSwal.close();
      await showSuccessResult("บันทึกผังองค์กรสำเร็จ");
    } catch (cause) {
      await appSwal.close();
      const message = cause instanceof Error ? cause.message : "ไม่สามารถบันทึกผังองค์กร";
      setError(message);
      await showErrorResult("บันทึกผังองค์กรไม่สำเร็จ", new Error(message), "โหลดหน่วยงานล่าสุดแล้วลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h3" sx={{ fontSize: "1.2rem", fontWeight: 700 }}>
            จัดระดับและผังบุคลากร
          </Typography>
          <Typography variant="body2" color="text.secondary">
            กำหนดรูปแบบและระดับต่อหน่วยงานโดยไม่เปลี่ยนทะเบียนบุคลากร ตำแหน่ง หรือการมอบหมายหน้าที่
          </Typography>
          <TextField
            select
            fullWidth
            label="รูปแบบผัง"
            value={mode}
            disabled={busy || !canManage}
            onChange={(event) => setMode(event.target.value as OrganizationChartMode)}
          >
            <MenuItem value="cards">รูปแบบเดิม — การ์ดรายการ</MenuItem>
            <MenuItem value="rows">แบบ A — แบ่งตามระดับและแถว</MenuItem>
            <MenuItem value="tree">แบบ B — สายบังคับบัญชา</MenuItem>
          </TextField>
          {!allPositionsLoaded && (
            <Alert severity="info">กรุณาโหลดตำแหน่งทั้งหมดก่อนจัดวาง เพื่อไม่ให้บันทึกผังจากข้อมูลไม่ครบ</Alert>
          )}
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          {(mode === "rows" || mode === "tree") && (
            <>
              <Stack spacing={1}>
                {positions.map((position) => {
                  const placement =
                    layout[position.id] ??
                    chartPlacement(undefined, {
                      id: position.id,
                      groupSortOrder: position.group_sort_order,
                      sortOrder: position.sort_order
                    });
                  return (
                    <Box
                      key={position.id}
                      sx={{ border: "1px solid", borderColor: "divider", p: 1.5, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 600, mb: 1 }}>{position.title}</Typography>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                        <TextField
                          size="small"
                          label="ระดับชั้น"
                          type="number"
                          value={placement.level}
                          disabled={busy || !canManage}
                          slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                          onChange={(event) => patch(position.id, "level", Number(event.target.value))}
                        />
                        <TextField
                          size="small"
                          label="แถว"
                          type="number"
                          value={placement.row}
                          disabled={busy || !canManage}
                          slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                          onChange={(event) => patch(position.id, "row", Number(event.target.value))}
                        />
                        <TextField
                          size="small"
                          label="ลำดับซ้ายไปขวา"
                          type="number"
                          value={placement.order}
                          disabled={busy || !canManage}
                          slotProps={{ htmlInput: { min: 0, max: 1000000, step: 1 } }}
                          onChange={(event) => patch(position.id, "order", Number(event.target.value))}
                        />
                        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || placement.level <= 1}
                            onClick={() => adjustPlacement(position.id, "level", -1, placement.level)}
                          >
                            ย้ายขึ้น
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || placement.level >= 100}
                            onClick={() => adjustPlacement(position.id, "level", 1, placement.level)}
                          >
                            ย้ายลง
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || placement.row >= 100}
                            onClick={() => adjustPlacement(position.id, "row", 1, placement.row)}
                          >
                            เพิ่มแถว
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || placement.order <= 0}
                            onClick={() => adjustPlacement(position.id, "order", -1, placement.order)}
                          >
                            เลื่อนซ้าย
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || placement.order >= 1000000}
                            onClick={() => adjustPlacement(position.id, "order", 1, placement.order)}
                          >
                            เลื่อนขวา
                          </Button>
                        </Stack>
                        {mode === "tree" && (
                          <TextField
                            size="small"
                            select
                            label="ขึ้นตรงต่อตำแหน่ง"
                            value={placement.parentPositionId ?? ""}
                            disabled={busy || !canManage}
                            sx={{ minWidth: { md: 230 } }}
                            onChange={(event) => patch(position.id, "parentPositionId", event.target.value || null)}
                          >
                            <MenuItem value="">ไม่มี — ตำแหน่งหลัก</MenuItem>
                            {positions
                              .filter(
                                (parent) =>
                                  parent.id !== position.id && (layout[parent.id]?.level ?? 1) < placement.level
                              )
                              .map((parent) => (
                                <MenuItem key={parent.id} value={parent.id}>
                                  {parent.title}
                                </MenuItem>
                              ))}
                          </TextField>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
              <Typography variant="h4" sx={{ fontSize: "1rem", fontWeight: 700 }}>
                ตัวอย่างผัง
              </Typography>
              <OrganizationChartView
                mode={mode}
                positions={previewPositions}
                layout={layout}
                media={new Map()}
                showEducationQualifications={unit.unit_kind === "department"}
              />
              <Typography variant="caption" color="text.secondary">
                ตัวอย่างในแอดมินแสดงชื่อและตำแหน่ง ส่วนหน้าสาธารณะจะแสดงภาพจาก Media Library
              </Typography>
            </>
          )}
          <Button variant="contained" disabled={!canManage || busy || !allPositionsLoaded} onClick={() => void save()}>
            {busy ? "กำลังบันทึก..." : "บันทึกโครงสร้างผัง"}
          </Button>
          {savedMode !== mode && <Typography variant="caption">มีการเปลี่ยนรูปแบบที่ยังไม่ได้บันทึก</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
}
