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
  showCardsPreview?: boolean;
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
  showCardsPreview = true,
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
  // Large units start with the approved chart preview visible and the detailed field list collapsed.
  // Small units retain immediate editing controls for established keyboard/touch workflows.
  const [showPositionControls, setShowPositionControls] = useState(positions.length <= 3);
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
    if (busy || !canManage || !isChanged || !allPositionsLoaded || awaitingLatestRevision || staleRevision) return;
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
        : cause instanceof Error
          ? cause.message
          : "ไม่สามารถบันทึกผังองค์กร";
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
            <Chip
              size="small"
              variant="outlined"
              label={"บันทึกแล้ว: " + (savedMode === "rows" ? "แบบ A" : savedMode === "tree" ? "แบบ B" : "Cards")}
            />
            <Chip size="small" variant="outlined" label={"Unit Revision: " + unit.unit_revision} />
            <Chip
              size="small"
              color={isChanged ? "warning" : "default"}
              label={isChanged ? "มีการแก้ไขที่ยังไม่บันทึก" : "ตรงกับข้อมูลที่บันทึก"}
            />
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
          <Typography variant="body2" color="text.secondary" role="status">
            {mode === "rows"
              ? "แบบ A: จัดตำแหน่งตามระดับจากบนลงล่าง และเรียงตำแหน่งระดับเดียวกันจากซ้ายไปขวา"
              : mode === "tree"
                ? "แบบ B: เชื่อมผู้บังคับบัญชากับตำแหน่งที่ขึ้นตรง โดยยังคงจัดผู้บังคับบัญชาไว้ด้านบน"
                : "Cards: แสดงการ์ดตำแหน่งตามลำดับ โดยไม่สร้างเส้นสายบังคับบัญชา"}
          </Typography>
          {staleRevision && (
            <Alert severity="warning" role="alert">
              Revision ของหน่วยงานไม่ตรงกัน กรุณาโหลดหน่วยงานล่าสุดก่อนบันทึกผัง
            </Alert>
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
          <Box
            component="section"
            role="region"
            aria-label="ตัวอย่างผังสายบังคับบัญชาก่อนบันทึก"
            data-organization-preview="hierarchy"
            sx={{
              width: "100%",
              minWidth: 0,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: { xs: 1, sm: 2 }
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="h4" sx={{ fontSize: "1.05rem", fontWeight: 700 }}>
                ตัวอย่างผังสายบังคับบัญชา — {unit.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ผู้บังคับบัญชาอยู่ด้านบน ผู้ใต้บังคับบัญชาอยู่ด้านล่าง และตำแหน่งระดับเดียวกันเรียงแนวนอน
                ปรับระดับหรือผู้บังคับบัญชาในฟอร์มด้านล่างแล้วดูผลที่นี่ก่อนบันทึก
              </Typography>
              {previewPositions.length === 0 ? (
                <Alert severity="info">ยังไม่มีตำแหน่งในหน่วยงานนี้</Alert>
              ) : mode === "cards" ? (
                showCardsPreview ? (
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
                  <Typography variant="body2" color="text.secondary">
                    รูปแบบ Cards ไม่มีสายบังคับบัญชา
                  </Typography>
                )
              ) : (
                <OrganizationChartView
                  mode={mode}
                  positions={previewPositions}
                  layout={layout}
                  media={new Map()}
                  showEducationQualifications={unit.unit_kind === "department"}
                />
              )}
              <Typography variant="caption" color="text.secondary">
                ตัวอย่างใช้ข้อมูลที่โหลดแล้วเท่านั้น หน้าสาธารณะจะแสดงรูปภาพจาก Media Library เมื่อเผยแพร่
              </Typography>
            </Stack>
          </Box>
          {(mode === "rows" || mode === "tree") && (
            <>
              {positions.length > 3 && (
                <Button
                  variant="outlined"
                  aria-expanded={showPositionControls}
                  aria-controls={showPositionControls ? "organization-position-layout-fields" : undefined}
                  onClick={() => setShowPositionControls((current) => !current)}
                >
                  {showPositionControls
                    ? `ซ่อนตัวเลือกจัดตำแหน่ง (${positions.length} ตำแหน่ง)`
                    : `แสดงตัวเลือกจัดตำแหน่ง (${positions.length} ตำแหน่ง)`}
                </Button>
              )}
              {showPositionControls && (
                <Stack id="organization-position-layout-fields" spacing={1}>
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
                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          data-testid={`organization-position-layout-controls-${position.id}`}
                          sx={{ flexWrap: "wrap", alignItems: "flex-start", minWidth: 0 }}
                        >
                          <TextField
                            size="small"
                            sx={{ width: { xs: "100%", sm: 160 }, maxWidth: "100%" }}
                            label="ระดับชั้น"
                            type="number"
                            value={placement.level}
                            disabled={busy || !canManage || awaitingLatestRevision}
                            slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                            onChange={(event) => patch(position.id, "level", Number(event.target.value))}
                          />
                          <TextField
                            size="small"
                            sx={{ width: { xs: "100%", sm: 145 }, maxWidth: "100%" }}
                            label="แถว"
                            type="number"
                            value={placement.row}
                            disabled={busy || !canManage || awaitingLatestRevision}
                            slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                            onChange={(event) => patch(position.id, "row", Number(event.target.value))}
                          />
                          <TextField
                            size="small"
                            sx={{ width: { xs: "100%", sm: 180 }, maxWidth: "100%" }}
                            label="ลำดับซ้ายไปขวา"
                            type="number"
                            value={placement.order}
                            disabled={busy || !canManage || awaitingLatestRevision}
                            slotProps={{ htmlInput: { min: 0, max: 1000000, step: 1 } }}
                            onChange={(event) => patch(position.id, "order", Number(event.target.value))}
                          />
                          <Stack
                            direction="row"
                            spacing={0.5}
                            useFlexGap
                            sx={{ flexWrap: "wrap", flex: "1 1 100%", minWidth: 0 }}
                          >
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
                              sx={{ width: { xs: "100%", sm: 260 }, maxWidth: "100%", minWidth: 0 }}
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
              )}
            </>
          )}
          <Button
            variant="contained"
            disabled={
              !canManage || busy || !isChanged || !allPositionsLoaded || awaitingLatestRevision || staleRevision
            }
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
