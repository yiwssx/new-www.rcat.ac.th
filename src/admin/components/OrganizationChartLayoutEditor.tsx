import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
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
import OrganizationUnitPositionContent from "../../public/components/OrganizationUnitPositionContent";
import { isAdminStaleRevisionError } from "../../features/admin-write/errors";

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
  // A successful write advances the server revision. Never resubmit the old revision
  // while the parent query is refreshing or if that refresh failed.
  const [awaitingLatestRevision, setAwaitingLatestRevision] = useState(false);
  const [error, setError] = useState("");
  const [savedMode, setSavedMode] = useState(unit.chart_mode ?? "cards");
  const [savedLayout, setSavedLayout] = useState<OrganizationChartLayout>(layout);
  const isChanged = savedMode !== mode || JSON.stringify(savedLayout) !== JSON.stringify(layout);
  const staleRevision = unit.content_revision !== unit.unit_revision;
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
    if (busy || !canManage || !allPositionsLoaded || awaitingLatestRevision || staleRevision) return;
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
    } catch (cause) {
      await appSwal.close();
      const stale = isAdminStaleRevisionError(cause);
      if (stale) setAwaitingLatestRevision(true);
      const message = stale
        ? "Revision เปลี่ยนแล้ว กรุณารีเฟรชหน่วยงานก่อนบันทึกอีกครั้ง"
        : cause instanceof Error ? cause.message : "ไม่สามารถบันทึกผังองค์กร";
      setError(message);
      setBusy(false);
      await showErrorResult("บันทึกผังองค์กรไม่สำเร็จ", new Error(message), "โหลดหน่วยงานล่าสุดแล้วลองอีกครั้ง");
      return;
    }

    // The database commit has succeeded. A separate refresh failure must never
    // be reported as a failed save or retried with the now-stale revision.
    setAwaitingLatestRevision(true);
    setSavedMode(mode);
    setSavedLayout(validated);
    try {
      await onSaved();
    } catch {
      setError("บันทึกผังองค์กรแล้ว แต่โหลด Revision ล่าสุดไม่สำเร็จ กรุณารีเฟรชหน้านี้ก่อนแก้ไขอีกครั้ง");
    }
    await appSwal.close();
    setBusy(false);
    await showSuccessResult("บันทึกผังองค์กรสำเร็จ");
  }

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h3" sx={{ fontSize: "1.2rem", fontWeight: 700 }}>
            จัดระดับและผังบุคลากร
          </Typography>
          <Typography variant="body2" color="text.secondary">
            2. ผังบุคลากรในหน่วยงานนี้ — เลือก A/B หรือ Cards โดยไม่เปลี่ยนลำดับชั้นหน่วยงานแม่–ลูก
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Chip size="small" variant="outlined" label={"บันทึกแล้ว: " + (savedMode === "rows" ? "แบบ A" : savedMode === "tree" ? "แบบ B" : "Cards")} />
            <Chip size="small" variant="outlined" label={"Unit Revision: " + unit.unit_revision} />
            <Chip size="small" color={isChanged ? "warning" : "default"} label={isChanged ? "มีการแก้ไขที่ยังไม่บันทึก" : "ตรงกับข้อมูลที่บันทึก"} />
          </Stack>
          <TextField
            select
            fullWidth
            label="รูปแบบผัง"
            value={mode}
            disabled={busy || !canManage || awaitingLatestRevision}
            onChange={(event) => setMode(event.target.value as OrganizationChartMode)}
          >
            <MenuItem value="cards">รูปแบบเดิม — การ์ดรายการ</MenuItem>
            <MenuItem value="rows">แบบ A — แบ่งตามระดับและแถว</MenuItem>
            <MenuItem value="tree">แบบ B — สายบังคับบัญชา</MenuItem>
          </TextField>
          {staleRevision && (
            <Alert severity="warning" role="alert">Revision ของหน่วยงานไม่ตรงกัน กรุณาโหลดหน่วยงานล่าสุดก่อนบันทึกผัง</Alert>
          )}
          {!allPositionsLoaded && (
            <Alert severity="info">กรุณาโหลดตำแหน่งทั้งหมดก่อนจัดวาง เพื่อไม่ให้บันทึกผังจากข้อมูลไม่ครบ</Alert>
          )}
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          {awaitingLatestRevision && !error && (
            <Alert severity="info" role="status">
              บันทึกผังแล้ว กำลังโหลด Revision ล่าสุดก่อนอนุญาตให้แก้ไขอีกครั้ง
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
                          disabled={busy || !canManage || awaitingLatestRevision}
                          slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                          onChange={(event) => patch(position.id, "level", Number(event.target.value))}
                        />
                        <TextField
                          size="small"
                          label="แถว"
                          type="number"
                          value={placement.row}
                          disabled={busy || !canManage || awaitingLatestRevision}
                          slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                          onChange={(event) => patch(position.id, "row", Number(event.target.value))}
                        />
                        <TextField
                          size="small"
                          label="ลำดับซ้ายไปขวา"
                          type="number"
                          value={placement.order}
                          disabled={busy || !canManage || awaitingLatestRevision}
                          slotProps={{ htmlInput: { min: 0, max: 1000000, step: 1 } }}
                          onChange={(event) => patch(position.id, "order", Number(event.target.value))}
                        />
                        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || awaitingLatestRevision || placement.level <= 1}
                            onClick={() => adjustPlacement(position.id, "level", -1, placement.level)}
                          >
                            ย้ายขึ้น
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || awaitingLatestRevision || placement.level >= 100}
                            onClick={() => adjustPlacement(position.id, "level", 1, placement.level)}
                          >
                            ย้ายลง
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || awaitingLatestRevision || placement.row >= 100}
                            onClick={() => adjustPlacement(position.id, "row", 1, placement.row)}
                          >
                            เพิ่มแถว
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || awaitingLatestRevision || placement.order <= 0}
                            onClick={() => adjustPlacement(position.id, "order", -1, placement.order)}
                          >
                            เลื่อนซ้าย
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={busy || !canManage || awaitingLatestRevision || placement.order >= 1000000}
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
                            disabled={busy || !canManage || awaitingLatestRevision}
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
                Preview ใช้ข้อมูลที่โหลดแล้วเท่านั้น ระบบเผยแพร่จะแสดงรูปภาพตามการตั้งค่า Media Library
              </Typography>
            </>
          )}
          {mode === "cards" && (
            <Stack spacing={1}>
              <Typography variant="h4" sx={{ fontSize: "1rem", fontWeight: 700 }}>
                ตัวอย่าง Cards (รูปแบบเดิม)
              </Typography>
              {previewPositions.length ? (
                <OrganizationUnitPositionContent
                  unit={{
                    contentId: unit.content_id,
                    parentContentId: unit.parent_content_id,
                    slug: unit.slug,
                    title: unit.title,
                    summary: unit.summary,
                    unitKind: unit.unit_kind,
                    sortOrder: unit.sort_order,
                    depth: 0,
                    chartMode: "cards"
                  }}
                  positions={previewPositions}
                  media={new Map()}
                />
              ) : (
                <Alert severity="info">ยังไม่มีตำแหน่งในหน่วยงานนี้</Alert>
              )}
            </Stack>
          )}
          <Button
            variant="contained"
            disabled={!canManage || busy || !allPositionsLoaded || awaitingLatestRevision || staleRevision}
            onClick={() => void save()}
          >
            {busy ? "กำลังบันทึก..." : "บันทึกโครงสร้างผัง"}
          </Button>
          {isChanged && <Typography variant="caption">มีการเปลี่ยนแปลงผังที่ยังไม่ได้บันทึก</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
}
