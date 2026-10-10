import { useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { isAdminStaleRevisionError } from "../../features/admin-write/errors";
import {
  createOrganizationRecord,
  deleteOrganizationRecord,
  getOrganizationCollection,
  invalidateOrganizationQueries,
  updateOrganizationRecord,
  type OrganizationAssignmentRow,
  type OrganizationAssignmentWrite,
  type OrganizationPersonnelRow,
  type OrganizationPositionRow,
  type OrganizationPositionWrite,
  type OrganizationUnitListRow
} from "../../features/organization-admin";
import { appSwal } from "../../utils/swal";
import { enabledDistinctOccupants, flattenOrganizationHierarchy, positionsForUnit } from "./organizationBuilderModel";

interface Props {
  units: readonly OrganizationUnitListRow[];
  allUnitsLoaded: boolean;
  canManage: boolean;
  onEditUnit?: (unit: OrganizationUnitListRow) => void;
}

type PositionForm = Required<Omit<OrganizationPositionWrite, "occupantLimit">> & {
  occupantLimit: number | null;
};

type AssignmentForm = Required<OrganizationAssignmentWrite>;

const emptyPosition = (unitContentId: string): PositionForm => ({
  unitContentId,
  title: "",
  groupLabel: "",
  groupSortOrder: 0,
  sortOrder: 0,
  displayStyle: "default",
  occupantLimit: null
});

const emptyAssignment = (positionId: string): AssignmentForm => ({
  personnelId: "",
  positionId,
  dutyDetail: "",
  sortOrder: 0,
  startsAt: "",
  endsAt: "",
  enabled: true
});

function asMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "ไม่สามารถบันทึกข้อมูลได้";
}

function safeNumber(value: number, min: number, max: number) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function pageQuery(collection: "positions" | "assignments" | "personnel") {
  return {
    queryKey: ["admin-organization", collection, "builder", "pages"],
    initialPageParam: 0,
    queryFn: ({ pageParam }: { pageParam: number }) => getOrganizationCollection(collection, 100, pageParam),
    getNextPageParam: (lastPage: { nextOffset: number | null }) => lastPage.nextOffset ?? undefined
  };
}

/**
 * Phase 6 builder. Non-drag controls are first class: every field and ordering
 * value is editable with keyboard/touch. The Worker owns revisions, capacity
 * checks, referential integrity and the immutable audit boundary.
 */
export default function OrganizationBuilder({ units, allUnitsLoaded, canManage, onEditUnit }: Props) {
  const client = useQueryClient();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [positionEditing, setPositionEditing] = useState<OrganizationPositionRow | null>(null);
  const [positionForm, setPositionForm] = useState<PositionForm | null>(null);
  const [assignmentEditing, setAssignmentEditing] = useState<OrganizationAssignmentRow | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");

  const positionsQuery = useInfiniteQuery(pageQuery("positions"));
  const assignmentsQuery = useInfiniteQuery(pageQuery("assignments"));
  const personnelQuery = useInfiniteQuery(pageQuery("personnel"));
  const positions = useMemo(
    () => (positionsQuery.data?.pages.flatMap((page) => page.items) ?? []) as OrganizationPositionRow[],
    [positionsQuery.data]
  );
  const assignments = useMemo(
    () => (assignmentsQuery.data?.pages.flatMap((page) => page.items) ?? []) as OrganizationAssignmentRow[],
    [assignmentsQuery.data]
  );
  const personnel = useMemo(
    () => (personnelQuery.data?.pages.flatMap((page) => page.items) ?? []) as OrganizationPersonnelRow[],
    [personnelQuery.data]
  );
  const hierarchy = useMemo(() => flattenOrganizationHierarchy(units), [units]);
  const selectedUnit = units.find((unit) => unit.content_id === selectedUnitId) ?? null;
  const visiblePositions = useMemo(
    () => positionsForUnit(positions, selectedUnit?.content_id ?? ""),
    [positions, selectedUnit?.content_id]
  );
  const assignmentsByPosition = useMemo(() => {
    const result = new Map<string, OrganizationAssignmentRow[]>();
    for (const assignment of assignments) {
      const items = result.get(assignment.position_id) ?? [];
      items.push(assignment);
      result.set(assignment.position_id, items);
    }
    for (const items of result.values()) items.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    return result;
  }, [assignments]);
  const byPerson = useMemo(() => new Map(personnel.map((person) => [person.id, person])), [personnel]);
  const byUnit = useMemo(() => new Map(units.map((unit) => [unit.content_id, unit])), [units]);

  async function refresh() {
    await invalidateOrganizationQueries(client);
  }

  function openPosition(row: OrganizationPositionRow | null) {
    if (!canManage || (!row && !selectedUnit)) return;
    setDialogError("");
    setError("");
    setPositionEditing(row);
    setPositionForm(
      row
        ? {
            unitContentId: row.unit_content_id,
            title: row.title,
            groupLabel: row.group_label,
            groupSortOrder: row.group_sort_order,
            sortOrder: row.sort_order,
            displayStyle: row.display_style,
            occupantLimit: row.occupant_limit
          }
        : emptyPosition(selectedUnit?.content_id ?? "")
    );
  }

  function openAssignment(row: OrganizationAssignmentRow | null, positionId: string) {
    if (!canManage) return;
    setDialogError("");
    setError("");
    setAssignmentEditing(row);
    setAssignmentForm(
      row
        ? {
            personnelId: row.personnel_id,
            positionId: row.position_id,
            dutyDetail: row.duty_detail,
            sortOrder: row.sort_order,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            enabled: row.enabled === 1
          }
        : emptyAssignment(positionId)
    );
  }

  async function savePosition() {
    if (!canManage || !positionForm || busy) return;
    if (
      !positionForm.title.trim() ||
      !safeNumber(positionForm.sortOrder, 0, 1000000) ||
      !safeNumber(positionForm.groupSortOrder, 0, 1000000) ||
      (positionForm.occupantLimit !== null && !safeNumber(positionForm.occupantLimit, 1, 500))
    ) {
      setDialogError("ตรวจสอบชื่อตำแหน่งและตัวเลขลำดับ/จำนวนผู้ดำรงตำแหน่ง");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      if (positionEditing) {
        await updateOrganizationRecord("positions", positionEditing.id, positionEditing.revision, positionForm);
      } else {
        await createOrganizationRecord("positions", positionForm);
      }
      await refresh();
      setPositionForm(null);
      setPositionEditing(null);
      setNotice("บันทึกตำแหน่งของหน่วยงานแล้ว");
    } catch (cause) {
      if (isAdminStaleRevisionError(cause)) {
        setPositionForm(null);
        setError("ตำแหน่งถูกเปลี่ยนแปลงโดยผู้ดูแลอื่น กรุณาโหลดใหม่ก่อนแก้ไข");
        await refresh();
      } else {
        setDialogError(asMessage(cause));
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveAssignment() {
    if (!canManage || !assignmentForm || busy) return;
    const checkDate = (date: string) =>
      !date || (Number.isFinite(Date.parse(date)) && new Date(date).toISOString() === date);
    if (
      !assignmentForm.personnelId ||
      !assignmentForm.positionId ||
      !safeNumber(assignmentForm.sortOrder, 0, 1000000) ||
      !checkDate(assignmentForm.startsAt) ||
      !checkDate(assignmentForm.endsAt) ||
      (assignmentForm.endsAt !== "" && (!assignmentForm.startsAt || assignmentForm.endsAt < assignmentForm.startsAt))
    ) {
      setDialogError("กรุณาระบุบุคลากร ตำแหน่ง ลำดับ และช่วงวันเวลา ISO UTC ให้ถูกต้อง");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      if (assignmentEditing) {
        await updateOrganizationRecord("assignments", assignmentEditing.id, assignmentEditing.revision, assignmentForm);
      } else {
        await createOrganizationRecord("assignments", assignmentForm);
      }
      await refresh();
      setAssignmentForm(null);
      setAssignmentEditing(null);
      setNotice("บันทึกการมอบหมายหน้าที่แล้ว");
    } catch (cause) {
      if (isAdminStaleRevisionError(cause)) {
        setAssignmentForm(null);
        setError("หน้าที่ถูกเปลี่ยนแปลงโดยผู้ดูแลอื่น กรุณาโหลดใหม่ก่อนแก้ไข");
        await refresh();
      } else {
        setDialogError(asMessage(cause));
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind: "positions" | "assignments", row: OrganizationPositionRow | OrganizationAssignmentRow) {
    if (!canManage || busy) return;
    const confirmed = await appSwal.fire({
      title: kind === "positions" ? "ลบตำแหน่งนี้?" : "ลบหน้าที่นี้?",
      text:
        kind === "positions"
          ? "ต้องนำการมอบหมายที่อ้างถึงตำแหน่งนี้ออกก่อน ระบบไม่ลบข้อมูลที่เชื่อมโยงอัตโนมัติ"
          : "การลบหน้าที่ไม่ลบประวัติบุคลากรจากทะเบียนกลาง",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันลบ",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmed.isConfirmed) return;
    setBusy(true);
    setError("");
    try {
      await deleteOrganizationRecord(kind, row.id, row.revision);
      await refresh();
      setNotice("ลบรายการแล้ว");
    } catch (cause) {
      setError(isAdminStaleRevisionError(cause) ? "Revision เปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่" : asMessage(cause));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const pageControl = (
    label: string,
    query: typeof positionsQuery | typeof assignmentsQuery | typeof personnelQuery
  ) =>
    query.hasNextPage ? (
      <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} variant="outlined">
        {query.isFetchingNextPage ? "กำลังโหลด…" : "โหลด" + label + "เพิ่มเติม"}
      </Button>
    ) : null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: "1.25rem" }}>
              ตัวจัดโครงสร้างองค์กร
            </Typography>
            <Typography color="text.secondary" variant="body2">
              เลือกฝ่าย งาน หรือแผนก แล้วกำหนดตำแหน่งและหน้าที่ของบุคลากรคนเดียวในหลายหน่วยงานได้
            </Typography>
          </Box>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          {notice && (
            <Alert severity="success" role="status">
              {notice}
            </Alert>
          )}
          {!allUnitsLoaded && (
            <Alert severity="warning">
              รายการหน่วยงานยังโหลดไม่ครบ กรุณาโหลดหน่วยงานเพิ่มเติมด้านบนก่อนเลือกจัดโครงสร้าง
            </Alert>
          )}
          {(positionsQuery.isError || assignmentsQuery.isError || personnelQuery.isError) && (
            <Alert severity="error">โหลดข้อมูลตำแหน่ง/หน้าที่/บุคลากรไม่สำเร็จ กรุณารีเฟรช</Alert>
          )}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ minWidth: 0 }}>
            <Box sx={{ width: { xs: "100%", md: "35%" }, minWidth: 0 }}>
              <Typography variant="h3" sx={{ fontSize: "1rem", mb: 1 }}>
                ลำดับชั้นหน่วยงาน
              </Typography>
              <Box component="nav" aria-label="โครงสร้างหน่วยงาน" sx={{ maxHeight: 480, overflowY: "auto" }}>
                <Stack spacing={0.5}>
                  {hierarchy.map(({ unit, depth, detached }) => (
                    <Button
                      key={unit.content_id}
                      fullWidth
                      sx={{
                        textAlign: "left",
                        justifyContent: "flex-start",
                        pl: { xs: Math.min(depth, 3) * 1.5 + 1, md: Math.min(depth, 12) * 2 + 1 },
                        overflowWrap: "anywhere",
                        whiteSpace: "normal"
                      }}
                      color={unit.content_id === selectedUnitId ? "primary" : "inherit"}
                      variant={unit.content_id === selectedUnitId ? "contained" : "text"}
                      aria-current={unit.content_id === selectedUnitId ? "true" : undefined}
                      onClick={() => {
                        setSelectedUnitId(unit.content_id);
                        setError("");
                      }}
                    >
                      {unit.title}
                      {detached ? " (ไม่พบหน่วยงานแม่ในข้อมูลที่โหลด)" : ""}
                    </Button>
                  ))}
                </Stack>
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
                  <Typography variant="h3" sx={{ fontSize: "1rem", overflowWrap: "anywhere" }}>
                    {selectedUnit ? "ตำแหน่งใน " + selectedUnit.title : "เลือกหน่วยงานจากรายการด้านซ้าย"}
                  </Typography>
                  {selectedUnit && canManage && (
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                      {onEditUnit && (
                        <Button variant="outlined" disabled={busy} onClick={() => onEditUnit(selectedUnit)}>
                          แก้ไขหน่วยงาน/ลำดับชั้น
                        </Button>
                      )}
                      <Button variant="contained" disabled={busy} onClick={() => openPosition(null)}>
                        เพิ่มตำแหน่ง
                      </Button>
                    </Stack>
                  )}
                </Stack>
                {positionsQuery.isPending && <Typography role="status">กำลังโหลดตำแหน่ง…</Typography>}
                {selectedUnit &&
                  visiblePositions.length === 0 &&
                  !positionsQuery.isPending &&
                  !positionsQuery.isError && (
                    <Alert severity="info">
                      {positionsQuery.hasNextPage
                        ? "ยังไม่พบตำแหน่งของหน่วยงานนี้ในรายการที่โหลด กรุณาโหลดหน้าถัดไป"
                        : "ยังไม่มีตำแหน่งในหน่วยงานนี้"}
                    </Alert>
                  )}
                {visiblePositions.map((position) => {
                  const assigned = assignmentsByPosition.get(position.id) ?? [];
                  return (
                    <Box key={position.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          sx={{ justifyContent: "space-between" }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{position.title}</Typography>
                            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                              {position.group_label && (
                                <Chip size="small" label={position.group_label} variant="outlined" />
                              )}
                              <Chip size="small" label={"ลำดับ " + position.sort_order} variant="outlined" />
                              {position.occupant_limit !== null &&
                                !assignmentsQuery.hasNextPage &&
                                !assignmentsQuery.isPending &&
                                !assignmentsQuery.isError && (
                                  <Chip
                                    size="small"
                                    label={
                                      "ผู้ดำรงตำแหน่ง " +
                                      enabledDistinctOccupants(assignments, position.id) +
                                      "/" +
                                      position.occupant_limit
                                    }
                                    variant="outlined"
                                  />
                                )}
                            </Stack>
                          </Box>
                          {canManage && (
                            <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap" }}>
                              <Button onClick={() => openPosition(position)} disabled={busy}>
                                แก้ไขตำแหน่ง
                              </Button>
                              <Button color="error" onClick={() => void remove("positions", position)} disabled={busy}>
                                ลบตำแหน่ง
                              </Button>
                            </Stack>
                          )}
                        </Stack>
                        {assigned.map((assignment) => (
                          <Box key={assignment.id} sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1 }}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              sx={{ justifyContent: "space-between" }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ overflowWrap: "anywhere" }}>
                                  {byPerson.get(assignment.personnel_id)?.display_name ??
                                    "บุคลากร " + assignment.personnel_id}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                                  {assignment.duty_detail || "ยังไม่ระบุหน้าที่"} · ลำดับ {assignment.sort_order}
                                  {assignment.enabled === 0 ? " · ปิดการแสดงผล" : ""}
                                </Typography>
                              </Box>
                              {canManage && (
                                <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap" }}>
                                  <Button disabled={busy} onClick={() => openAssignment(assignment, position.id)}>
                                    แก้ไขหน้าที่
                                  </Button>
                                  <Button
                                    color="error"
                                    disabled={busy}
                                    onClick={() => void remove("assignments", assignment)}
                                  >
                                    ลบหน้าที่
                                  </Button>
                                </Stack>
                              )}
                            </Stack>
                          </Box>
                        ))}
                        {canManage && (
                          <Button variant="outlined" disabled={busy} onClick={() => openAssignment(null, position.id)}>
                            มอบหมายบุคลากร
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {pageControl("ตำแหน่ง", positionsQuery)}
            {pageControl("หน้าที่", assignmentsQuery)}
            {pageControl("บุคลากร", personnelQuery)}
            <Button onClick={() => void refresh()} disabled={busy}>
              รีเฟรชข้อมูล
            </Button>
          </Stack>
          {(positionsQuery.hasNextPage || assignmentsQuery.hasNextPage || personnelQuery.hasNextPage) && (
            <Alert severity="info">
              ข้อมูลบางประเภทยังโหลดไม่ครบ กรุณาโหลดหน้าถัดไปก่อนตรวจสอบจำนวนผู้ดำรงตำแหน่งหรือเลือกบุคลากร
            </Alert>
          )}
          <Dialog open={positionForm !== null} onClose={() => !busy && setPositionForm(null)} fullWidth maxWidth="sm">
            <DialogTitle>{positionEditing ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่ง"}</DialogTitle>
            <DialogContent>
              {positionForm && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {dialogError && <Alert severity="error">{dialogError}</Alert>}
                  <TextField
                    label="ชื่อตำแหน่ง"
                    required
                    fullWidth
                    value={positionForm.title}
                    disabled={busy}
                    onChange={(event) => setPositionForm({ ...positionForm, title: event.target.value })}
                  />
                  <TextField
                    label="กลุ่มตำแหน่ง"
                    fullWidth
                    value={positionForm.groupLabel}
                    disabled={busy}
                    onChange={(event) => setPositionForm({ ...positionForm, groupLabel: event.target.value })}
                  />
                  <TextField
                    label="ลำดับกลุ่ม"
                    type="number"
                    fullWidth
                    value={positionForm.groupSortOrder}
                    disabled={busy}
                    onChange={(event) =>
                      setPositionForm({ ...positionForm, groupSortOrder: Number(event.target.value) })
                    }
                  />
                  <TextField
                    label="ลำดับตำแหน่ง"
                    type="number"
                    fullWidth
                    value={positionForm.sortOrder}
                    disabled={busy}
                    onChange={(event) => setPositionForm({ ...positionForm, sortOrder: Number(event.target.value) })}
                  />
                  <TextField
                    label="รูปแบบแสดงผล"
                    fullWidth
                    value={positionForm.displayStyle}
                    disabled={busy}
                    onChange={(event) => setPositionForm({ ...positionForm, displayStyle: event.target.value })}
                  />
                  <TextField
                    label="จำนวนผู้ดำรงตำแหน่งสูงสุด (ว่าง = ไม่จำกัด)"
                    type="number"
                    fullWidth
                    value={positionForm.occupantLimit ?? ""}
                    disabled={busy}
                    onChange={(event) =>
                      setPositionForm({
                        ...positionForm,
                        occupantLimit: event.target.value === "" ? null : Number(event.target.value)
                      })
                    }
                  />
                  <Alert severity="info">
                    เปลี่ยนลำดับได้ด้วยแป้นพิมพ์หรือปุ่มตัวเลข โดยระบบตรวจสอบ Revision ก่อนบันทึก
                  </Alert>
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPositionForm(null)} disabled={busy}>
                ยกเลิก
              </Button>
              <Button variant="contained" onClick={() => void savePosition()} disabled={busy}>
                บันทึกตำแหน่ง
              </Button>
            </DialogActions>
          </Dialog>
          <Dialog
            open={assignmentForm !== null}
            onClose={() => !busy && setAssignmentForm(null)}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>{assignmentEditing ? "แก้ไขการมอบหมาย" : "มอบหมายบุคลากร"}</DialogTitle>
            <DialogContent>
              {assignmentForm && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {dialogError && <Alert severity="error">{dialogError}</Alert>}
                  <TextField
                    label="บุคลากรจากทะเบียนกลาง"
                    select
                    fullWidth
                    required
                    disabled={busy}
                    value={assignmentForm.personnelId}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, personnelId: event.target.value })}
                  >
                    {assignmentForm.personnelId && !byPerson.has(assignmentForm.personnelId) && (
                      <MenuItem value={assignmentForm.personnelId} disabled>
                        รหัสบุคลากร {assignmentForm.personnelId} (ยังไม่ได้โหลดข้อมูล)
                      </MenuItem>
                    )}
                    {personnel.map((person) => (
                      <MenuItem key={person.id} value={person.id}>
                        {person.display_name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="ตำแหน่ง (สามารถย้ายข้ามหน่วยงาน)"
                    select
                    fullWidth
                    required
                    disabled={busy}
                    value={assignmentForm.positionId}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, positionId: event.target.value })}
                  >
                    {assignmentForm.positionId && !positions.some((row) => row.id === assignmentForm.positionId) && (
                      <MenuItem value={assignmentForm.positionId} disabled>
                        รหัสตำแหน่ง {assignmentForm.positionId} (ยังไม่ได้โหลดข้อมูล)
                      </MenuItem>
                    )}
                    {positions.map((position) => (
                      <MenuItem key={position.id} value={position.id}>
                        {(byUnit.get(position.unit_content_id)?.title ?? position.unit_content_id) +
                          " / " +
                          position.title}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="รายละเอียดหน้าที่"
                    multiline
                    minRows={2}
                    fullWidth
                    disabled={busy}
                    value={assignmentForm.dutyDetail}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, dutyDetail: event.target.value })}
                  />
                  <TextField
                    label="ลำดับการแสดง"
                    type="number"
                    fullWidth
                    disabled={busy}
                    value={assignmentForm.sortOrder}
                    onChange={(event) =>
                      setAssignmentForm({ ...assignmentForm, sortOrder: Number(event.target.value) })
                    }
                  />
                  <TextField
                    label="เริ่มดำรงหน้าที่ (ISO UTC, ไม่บังคับ)"
                    fullWidth
                    disabled={busy}
                    helperText="ตัวอย่าง 2026-10-10T00:00:00.000Z"
                    value={assignmentForm.startsAt}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, startsAt: event.target.value })}
                  />
                  <TextField
                    label="สิ้นสุดหน้าที่ (ISO UTC, ไม่บังคับ)"
                    fullWidth
                    disabled={busy}
                    value={assignmentForm.endsAt}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, endsAt: event.target.value })}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={assignmentForm.enabled}
                        disabled={busy}
                        onChange={(_, enabled) => setAssignmentForm({ ...assignmentForm, enabled })}
                      />
                    }
                    label="เปิดใช้งานการมอบหมายนี้"
                  />
                  <Alert severity="info">
                    บันทึกบุคลากรคนเดิมซ้ำในหลายตำแหน่งหรือหลายหน้าที่ได้ โดยไม่สร้างทะเบียนบุคลากรซ้ำ
                  </Alert>
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => setAssignmentForm(null)}>
                ยกเลิก
              </Button>
              <Button variant="contained" disabled={busy} onClick={() => void saveAssignment()}>
                บันทึกหน้าที่
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </CardContent>
    </Card>
  );
}
