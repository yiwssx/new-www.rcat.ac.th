import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropProvider } from "@dnd-kit/react";
import { arrayMove } from "@dnd-kit/helpers";
import { isSortable } from "@dnd-kit/react/sortable";
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
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { isAdminStaleRevisionError } from "../../features/admin-write/errors";
import {
  createOrganizationRecord,
  deleteOrganizationRecord,
  getOrganizationCollection,
  invalidateOrganizationQueries,
  reorderOrganizationRecords,
  updateOrganizationRecord,
  type OrganizationAssignmentRow,
  type OrganizationAssignmentWrite,
  type OrganizationPersonnelRow,
  type OrganizationPositionRow,
  type OrganizationPositionWrite,
  type OrganizationUnitListRow
} from "../../features/organization-admin";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { OrganizationSortableRow } from "./OrganizationSortableRow";
import OrganizationChartLayoutEditor from "./OrganizationChartLayoutEditor";
import {
  enabledDistinctOccupants,
  flattenOrganizationHierarchy,
  nextOrganizationSortOrder,
  organizationTreeItems,
  positionsForUnit
} from "./organizationBuilderModel";

interface Props {
  units: readonly OrganizationUnitListRow[];
  allUnitsLoaded: boolean;
  canManage: boolean;
  onEditUnit?: (unit: OrganizationUnitListRow) => void;
  view?: "legacy" | "positions" | "assignments" | "charts";
}

type PositionForm = Required<Omit<OrganizationPositionWrite, "occupantLimit">> & {
  occupantLimit: number | null;
};

type AssignmentForm = Required<OrganizationAssignmentWrite>;

const emptyPosition = (unitContentId: string, sortOrder = 0): PositionForm => ({
  unitContentId,
  title: "",
  groupLabel: "",
  groupSortOrder: 0,
  sortOrder,
  displayStyle: "default",
  occupantLimit: null
});

const emptyAssignment = (positionId: string, sortOrder = 0): AssignmentForm => ({
  personnelId: "",
  positionId,
  dutyDetail: "",
  sortOrder,
  enabled: true
});

function asMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "ไม่สามารถบันทึกข้อมูลได้";
}

function safeNumber(value: number, min: number, max: number) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function pageQuery(collection: "positions" | "assignments" | "personnel", unitId: string | null, legacy: boolean) {
  return {
    queryKey: ["admin-organization", collection, "builder", "pages", legacy ? "legacy" : unitId],
    enabled: legacy || Boolean(unitId),
    initialPageParam: 0,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      legacy
        ? getOrganizationCollection(collection, 100, pageParam)
        : getOrganizationCollection(collection, 100, pageParam, {
            includeTotal: true,
            unitContentId: unitId ?? undefined
          }),
    getNextPageParam: (lastPage: { nextOffset: number | null }) => lastPage.nextOffset ?? undefined
  };
}

/**
 * Phase 6 builder. Non-drag controls are first class: every field and ordering
 * value is editable with keyboard/touch. The Worker owns revisions, capacity
 * checks, referential integrity and the immutable audit boundary.
 */
export default function OrganizationBuilder({ units, allUnitsLoaded, canManage, onEditUnit, view = "legacy" }: Props) {
  const client = useQueryClient();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedUnitSnapshot, setSelectedUnitSnapshot] = useState<OrganizationUnitListRow | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitSearchDebounced, setUnitSearchDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setUnitSearchDebounced(unitSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [unitSearch]);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelSearchDebounced, setPersonnelSearchDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setPersonnelSearchDebounced(personnelSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [personnelSearch]);
  const [positionAutoOrder, setPositionAutoOrder] = useState(false);
  const [assignmentAutoOrder, setAssignmentAutoOrder] = useState(false);
  const [collapsedUnitIds, setCollapsedUnitIds] = useState<string[]>([]);
  const [positionEditing, setPositionEditing] = useState<OrganizationPositionRow | null>(null);
  const [positionForm, setPositionForm] = useState<PositionForm | null>(null);
  const [assignmentEditing, setAssignmentEditing] = useState<OrganizationAssignmentRow | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [notice, setNotice] = useState("");

  const legacy = view === "legacy";
  const searchedUnits = useQuery({
    queryKey: ["admin-organization", "units", "search", unitSearchDebounced],
    enabled: !legacy && unitSearchDebounced.length > 0,
    queryFn: () => getOrganizationCollection("units", 25, 0, { includeTotal: true, search: unitSearchDebounced })
  });
  const positionsQuery = useInfiniteQuery(pageQuery("positions", selectedUnitId, legacy));
  const assignmentsQuery = useInfiniteQuery(pageQuery("assignments", selectedUnitId, legacy));
  const personnelQuery = useInfiniteQuery(pageQuery("personnel", selectedUnitId, legacy));
  const personnelLookup = useQuery({
    queryKey: ["admin-organization", "personnel", "lookup", personnelSearchDebounced],
    enabled: assignmentForm !== null,
    queryFn: () =>
      getOrganizationCollection("personnel", 25, 0, { includeTotal: true, search: personnelSearchDebounced })
  });
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
  const treeItems = useMemo(() => organizationTreeItems(units), [units]);
  const expandedTreeIds = useMemo(
    () => hierarchy.map(({ unit }) => unit.content_id).filter((id) => !collapsedUnitIds.includes(id)),
    [hierarchy, collapsedUnitIds]
  );
  const selectedUnit =
    units.find((unit) => unit.content_id === selectedUnitId) ??
    (selectedUnitSnapshot?.content_id === selectedUnitId ? selectedUnitSnapshot : null);
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
  const personnelOptions = useMemo(() => {
    const options = new Map(personnel.map((person) => [person.id, person]));
    for (const person of personnelLookup.data?.items ?? []) options.set(person.id, person);
    return [...options.values()];
  }, [personnel, personnelLookup.data]);
  const byUnit = useMemo(() => {
    const map = new Map(units.map((unit) => [unit.content_id, unit]));
    if (selectedUnit) map.set(selectedUnit.content_id, selectedUnit);
    return map;
  }, [units, selectedUnit]);

  async function refresh() {
    await invalidateOrganizationQueries(client);
  }

  function openPosition(row: OrganizationPositionRow | null) {
    if (
      !canManage ||
      (!row && (!selectedUnit || positionsQuery.isPending || positionsQuery.isError))
    )
      return;
    setDialogError("");
    setError("");
    setPositionEditing(row);
    setPositionAutoOrder(!row);
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
        : emptyPosition(
            selectedUnit?.content_id ?? "",
            nextOrganizationSortOrder(
              visiblePositions.filter((position) => position.group_label === "" && position.group_sort_order === 0),
              (position) => position.sort_order
            )
          )
    );
  }

  function openAssignment(row: OrganizationAssignmentRow | null, positionId: string) {
    if (
      !canManage ||
      (!row && (assignmentsQuery.isPending || assignmentsQuery.isError))
    )
      return;
    setDialogError("");
    setError("");
    setAssignmentEditing(row);
    setAssignmentAutoOrder(!row);
    setPersonnelSearch("");
    setAssignmentForm(
      row
        ? {
            personnelId: row.personnel_id,
            positionId: row.position_id,
            dutyDetail: row.duty_detail,
            sortOrder: row.sort_order,
            enabled: row.enabled === 1
          }
        : emptyAssignment(
            positionId,
            nextOrganizationSortOrder(assignmentsByPosition.get(positionId) ?? [], (item) => item.sort_order)
          )
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
    setNotice("");
    const wasEditing = Boolean(positionEditing);
    showBlockingLoading("กำลังบันทึกตำแหน่ง");
    try {
      if (positionEditing) {
        await updateOrganizationRecord("positions", positionEditing.id, positionEditing.revision, positionForm);
      } else {
        await createOrganizationRecord(
          "positions",
          positionAutoOrder ? { ...positionForm, sortOrder: undefined, autoSortOrder: true } : positionForm
        );
      }
    } catch (cause) {
      await appSwal.close();
      const stale = isAdminStaleRevisionError(cause);
      const message = stale
        ? "ตำแหน่งถูกเปลี่ยนแปลงโดยผู้ดูแลอื่น กรุณาคัดลอกข้อมูลที่แก้ไขไว้แล้วปิดฟอร์มเพื่อเปิดข้อมูลล่าสุด"
        : asMessage(cause);
      setDialogError(message);
      if (stale) {
        void refresh();
      }
      setBusy(false);
      await showErrorResult("บันทึกตำแหน่งไม่สำเร็จ", new Error(message), "กรุณาลองอีกครั้ง");
      return;
    }
    await refresh().catch(() => {
      setError("บันทึกสำเร็จแล้ว แต่โหลดตำแหน่งล่าสุดไม่สำเร็จ กรุณารีเฟรช");
    });
    setPositionForm(null);
    setPositionEditing(null);
    setNotice(wasEditing ? "แก้ไขตำแหน่งแล้ว" : "เพิ่มตำแหน่งของหน่วยงานแล้ว");
    setBusy(false);
    await appSwal.close();
    await showSuccessResult("บันทึกตำแหน่งสำเร็จ");
  }

  async function saveAssignment() {
    if (!canManage || !assignmentForm || busy) return;
    if (
      !assignmentForm.personnelId ||
      !assignmentForm.positionId ||
      !safeNumber(assignmentForm.sortOrder, 0, 1000000)
    ) {
      setDialogError("กรุณาระบุบุคลากร ตำแหน่ง และลำดับให้ถูกต้อง");
      return;
    }
    setBusy(true);
    setDialogError("");
    setNotice("");
    const wasEditing = Boolean(assignmentEditing);
    showBlockingLoading("กำลังบันทึกการมอบหมายหน้าที่");
    try {
      if (assignmentEditing) {
        await updateOrganizationRecord("assignments", assignmentEditing.id, assignmentEditing.revision, assignmentForm);
      } else {
        await createOrganizationRecord(
          "assignments",
          assignmentAutoOrder ? { ...assignmentForm, sortOrder: undefined, autoSortOrder: true } : assignmentForm
        );
      }
    } catch (cause) {
      await appSwal.close();
      const stale = isAdminStaleRevisionError(cause);
      const message = stale
        ? "หน้าที่ถูกเปลี่ยนแปลงโดยผู้ดูแลอื่น กรุณาคัดลอกข้อมูลที่แก้ไขไว้แล้วปิดฟอร์มเพื่อเปิดข้อมูลล่าสุด"
        : asMessage(cause);
      setDialogError(message);
      if (stale) {
        void refresh();
      }
      setBusy(false);
      await showErrorResult("บันทึกหน้าที่ไม่สำเร็จ", new Error(message), "กรุณาลองอีกครั้ง");
      return;
    }
    await refresh().catch(() => {
      setError("บันทึกสำเร็จแล้ว แต่โหลดการมอบหมายล่าสุดไม่สำเร็จ กรุณารีเฟรช");
    });
    setAssignmentForm(null);
    setAssignmentEditing(null);
    setNotice(wasEditing ? "แก้ไขการมอบหมายหน้าที่แล้ว" : "บันทึกการมอบหมายหน้าที่แล้ว");
    setBusy(false);
    await appSwal.close();
    await showSuccessResult("บันทึกหน้าที่สำเร็จ");
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
    setNotice("");
    showBlockingLoading(kind === "positions" ? "กำลังลบตำแหน่ง" : "กำลังลบหน้าที่");
    try {
      await deleteOrganizationRecord(kind, row.id, row.revision);
    } catch (cause) {
      await appSwal.close();
      const message = isAdminStaleRevisionError(cause)
        ? "รายการถูกเปลี่ยนแปลงโดยผู้ดูแลอื่น กรุณาโหลดข้อมูลล่าสุดก่อนลบ"
        : asMessage(cause);
      setError(message);
      await refresh();
      setBusy(false);
      await showErrorResult("ลบรายการไม่สำเร็จ", new Error(message), "กรุณาลองอีกครั้ง");
      return;
    }
    await refresh().catch(() => {
      setError("ลบสำเร็จแล้ว แต่โหลดรายการล่าสุดไม่สำเร็จ กรุณารีเฟรช");
    });
    setNotice("ลบรายการแล้ว");
    setBusy(false);
    await appSwal.close();
    await showSuccessResult("ลบรายการสำเร็จ");
  }

  async function saveReorder(
    collection: "positions" | "assignments",
    scopeId: string,
    rows: readonly (OrganizationPositionRow | OrganizationAssignmentRow)[],
    groupLabel = "",
    groupSortOrder = 0
  ) {
    if (!canManage || busy || rows.length < 2 || rows.length > 500) return;
    setBusy(true);
    setError("");
    setNotice("");
    showBlockingLoading("กำลังจัดลำดับรายการ");
    try {
      await reorderOrganizationRecords(
        collection,
        scopeId,
        rows.map((row) => ({ id: row.id, revision: row.revision })),
        groupLabel,
        groupSortOrder
      );
    } catch (cause) {
      await appSwal.close();
      const message = isAdminStaleRevisionError(cause)
        ? "รายการถูกเปลี่ยนโดยผู้ดูแลอื่น กรุณาโหลดข้อมูลล่าสุดก่อนจัดลำดับ"
        : asMessage(cause);
      setError(message);
      await refresh();
      setBusy(false);
      await showErrorResult("จัดลำดับไม่สำเร็จ", new Error(message), "กรุณาลองอีกครั้ง");
      return;
    }
    await refresh().catch(() => {
      setError("จัดลำดับสำเร็จแล้ว แต่โหลดรายการล่าสุดไม่สำเร็จ กรุณารีเฟรช");
    });
    setNotice("จัดลำดับและบันทึกเรียบร้อยแล้ว");
    setBusy(false);
    await appSwal.close();
    await showSuccessResult("จัดลำดับสำเร็จ");
  }

  const positionGroupKey = (position: OrganizationPositionRow) =>
    JSON.stringify([position.unit_content_id, position.group_sort_order, position.group_label]);

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
              {view === "charts"
                ? "จัดผังองค์กร"
                : view === "assignments"
                  ? "มอบหมายหน้าที่"
                  : view === "positions"
                    ? "จัดการตำแหน่ง"
                    : "ตัวจัดโครงสร้างองค์กร"}
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
              เลือกหน่วยงานที่ปรากฏได้ทันที หรือโหลดหน่วยงานเพิ่มเติมเพื่อค้นหาหน่วยงานอื่น
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
              {!legacy && (
                <Stack spacing={1} sx={{ mb: 2 }}>
                  <TextField
                    label="ค้นหาหน่วยงานทั้งหมด"
                    size="small"
                    value={unitSearch}
                    onChange={(event) => setUnitSearch(event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 160 } }}
                    helperText="ค้นหาจากเซิร์ฟเวอร์ โดยไม่ต้องโหลดทุกหน่วยงาน"
                  />
                  {searchedUnits.isFetching && unitSearchDebounced && (
                    <Typography variant="caption">กำลังค้นหาหน่วยงาน…</Typography>
                  )}
                  {searchedUnits.isError && <Alert severity="error">ค้นหาหน่วยงานไม่สำเร็จ</Alert>}
                  {searchedUnits.data && unitSearchDebounced && (
                    <Box component="nav" aria-label="ผลการค้นหาหน่วยงาน" sx={{ maxHeight: 240, overflowY: "auto" }}>
                      <Typography variant="caption" color="text.secondary">
                        พบ {searchedUnits.data.total ?? searchedUnits.data.items.length} รายการ (แสดงสูงสุด 25)
                      </Typography>
                      {searchedUnits.data.items.map((unit) => (
                        <Button
                          key={unit.content_id}
                          size="small"
                          fullWidth
                          variant={selectedUnitId === unit.content_id ? "contained" : "text"}
                          sx={{ justifyContent: "flex-start", textAlign: "left" }}
                          onClick={() => {
                            setSelectedUnitId(unit.content_id);
                            setSelectedUnitSnapshot(unit);
                            setError("");
                          }}
                        >
                          {unit.title}
                        </Button>
                      ))}
                    </Box>
                  )}
                </Stack>
              )}
              <Box component="nav" aria-label="โครงสร้างหน่วยงาน" sx={{ maxHeight: 480, overflowY: "auto" }}>
                <RichTreeView
                  items={treeItems}
                  selectedItems={selectedUnitId}
                  expandedItems={expandedTreeIds}
                  aria-label="โครงสร้างหน่วยงาน"
                  onExpandedItemsChange={(_event, expanded) => {
                    setCollapsedUnitIds(
                      hierarchy.map(({ unit }) => unit.content_id).filter((id) => !expanded.includes(id))
                    );
                  }}
                  onSelectedItemsChange={(_event, id) => {
                    if (typeof id !== "string") return;
                    setSelectedUnitId(id);
                    setSelectedUnitSnapshot(units.find((unit) => unit.content_id === id) ?? null);
                    setError("");
                  }}
                  sx={{ "& .MuiTreeItem-label": { whiteSpace: "normal", overflowWrap: "anywhere" } }}
                />
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
                  <Typography variant="h3" sx={{ fontSize: "1rem", overflowWrap: "anywhere" }}>
                    {selectedUnit ? "ตำแหน่งใน " + selectedUnit.title : "เลือกหน่วยงานจากรายการด้านซ้าย"}
                  </Typography>
                  {selectedUnit && canManage && view !== "charts" && (
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                      {onEditUnit && view === "legacy" && (
                        <Button variant="outlined" disabled={busy} onClick={() => onEditUnit(selectedUnit)}>
                          แก้ไขหน่วยงาน/ลำดับชั้น
                        </Button>
                      )}
                      {view !== "assignments" && (
                        <Button
                          variant="contained"
                          disabled={
                            busy || positionsQuery.isPending || positionsQuery.isError
                          }
                          onClick={() => openPosition(null)}
                        >
                          เพิ่มตำแหน่ง
                        </Button>
                      )}
                    </Stack>
                  )}
                </Stack>
                {selectedUnit && positionsQuery.isPending && <Typography role="status">กำลังโหลดตำแหน่ง…</Typography>}
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
                <DragDropProvider
                  onDragEnd={({ operation, canceled }) => {
                    if (canceled || !isSortable(operation.source)) return;
                    const source = operation.source;
                    if (source.initialGroup !== source.group || source.initialIndex === source.index) return;
                    const group = visiblePositions.filter((row) => positionGroupKey(row) === source.initialGroup);
                    if (source.initialIndex < 0 || source.index < 0 || source.index >= group.length) return;
                    const first = group[0];
                    if (first) {
                      void saveReorder(
                        "positions",
                        first.unit_content_id,
                        arrayMove(group, source.initialIndex, source.index),
                        first.group_label,
                        first.group_sort_order
                      );
                    }
                  }}
                >
                  {visiblePositions.map((position) => {
                    const assigned = assignmentsByPosition.get(position.id) ?? [];
                    const siblings = visiblePositions.filter(
                      (row) => positionGroupKey(row) === positionGroupKey(position)
                    );
                    return (
                      <OrganizationSortableRow
                        key={position.id}
                        id={position.id}
                        index={siblings.findIndex((row) => row.id === position.id)}
                        group={positionGroupKey(position)}
                        label={position.title}
                        disabled={!canManage || busy || Boolean(positionsQuery.hasNextPage) || siblings.length < 2}
                      >
                        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                          <Stack spacing={1}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              sx={{ justifyContent: "space-between" }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                                  {position.title}
                                </Typography>
                                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                                  {position.group_label && (
                                    <Chip size="small" label={position.group_label} variant="outlined" />
                                  )}
                                  <Chip
                                    size="small"
                                    label={"อันดับ " + (siblings.findIndex((row) => row.id === position.id) + 1)}
                                    variant="outlined"
                                  />
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
                              {canManage && (view === "legacy" || view === "positions") && (
                                <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap" }}>
                                  <Button onClick={() => openPosition(position)} disabled={busy}>
                                    แก้ไขตำแหน่ง
                                  </Button>
                                  <Button
                                    color="error"
                                    onClick={() => void remove("positions", position)}
                                    disabled={busy}
                                  >
                                    ลบตำแหน่ง
                                  </Button>
                                </Stack>
                              )}
                            </Stack>
                            <DragDropProvider
                              onDragEnd={({ operation, canceled }) => {
                                if (canceled || !isSortable(operation.source)) return;
                                const source = operation.source;
                                if (
                                  source.initialIndex === source.index ||
                                  source.index < 0 ||
                                  source.index >= assigned.length
                                )
                                  return;
                                void saveReorder(
                                  "assignments",
                                  position.id,
                                  arrayMove(assigned, source.initialIndex, source.index)
                                );
                              }}
                            >
                              {assigned.map((assignment, index) => (
                                <OrganizationSortableRow
                                  key={assignment.id}
                                  id={assignment.id}
                                  index={index}
                                  group={position.id}
                                  label={byPerson.get(assignment.personnel_id)?.display_name ?? assignment.id}
                                  disabled={
                                    !canManage || busy || Boolean(assignmentsQuery.hasNextPage) || assigned.length < 2
                                  }
                                >
                                  <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1 }}>
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
                                        <Typography
                                          variant="body2"
                                          color="text.secondary"
                                          sx={{ overflowWrap: "anywhere" }}
                                        >
                                          {assignment.duty_detail || "ยังไม่ระบุหน้าที่"} · ลำดับ {index + 1}
                                          {assignment.enabled === 0 ? " · ปิดการแสดงผล" : ""}
                                        </Typography>
                                      </Box>
                                      {canManage && (view === "legacy" || view === "assignments") && (
                                        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap" }}>
                                          <Button
                                            disabled={busy}
                                            onClick={() => openAssignment(assignment, position.id)}
                                          >
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
                                </OrganizationSortableRow>
                              ))}
                            </DragDropProvider>
                            {canManage && (view === "legacy" || view === "assignments") && (
                              <Button
                                variant="outlined"
                                disabled={
                                  busy || assignmentsQuery.isPending || assignmentsQuery.isError
                                }
                                onClick={() => openAssignment(null, position.id)}
                              >
                                มอบหมายบุคลากร
                              </Button>
                            )}
                          </Stack>
                        </Box>
                      </OrganizationSortableRow>
                    );
                  })}
                </DragDropProvider>
              </Stack>
            </Box>
          </Stack>
          {selectedUnit && (positionsQuery.isPending || positionsQuery.hasNextPage) && (
            <Alert severity="info">
              กรุณาโหลดรายการตำแหน่งให้ครบก่อนจัดผัง เพื่อป้องกันค่าที่กำลังแก้ไขถูกรีเซ็ตระหว่างโหลดข้อมูล
            </Alert>
          )}
          {(view === "legacy" || view === "charts") &&
            selectedUnit &&
            !positionsQuery.isPending &&
            !positionsQuery.hasNextPage &&
            !positionsQuery.isError && (
              <OrganizationChartLayoutEditor
                key={`${selectedUnit.content_id}:${selectedUnit.unit_revision}:${visiblePositions.length}`}
                unit={selectedUnit}
                positions={visiblePositions}
                assignments={assignments}
                personnel={personnel}
                canManage={canManage}
                allPositionsLoaded={!positionsQuery.hasNextPage && !positionsQuery.isPending && !positionsQuery.isError}
                onSaved={refresh}
              />
            )}
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
              {(positionsQuery.hasNextPage || assignmentsQuery.hasNextPage) &&
                " และโหลดตำแหน่ง/หน้าที่ให้ครบก่อนเพิ่มรายการใหม่ เพื่อกำหนดอันดับถัดไปอย่างถูกต้อง"}
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
                    onChange={(event) => {
                      const groupLabel = event.target.value;
                      const sortOrder = positionEditing
                        ? positionForm.sortOrder
                        : nextOrganizationSortOrder(
                            positions.filter(
                              (position) =>
                                position.unit_content_id === positionForm.unitContentId &&
                                position.group_label === groupLabel &&
                                position.group_sort_order === positionForm.groupSortOrder
                            ),
                            (position) => position.sort_order
                          );
                      setPositionForm({ ...positionForm, groupLabel, sortOrder });
                    }}
                  />
                  <Box
                    component="details"
                    sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}
                  >
                    <Box component="summary" sx={{ cursor: "pointer", fontWeight: 600 }}>
                      ตั้งค่าลำดับด้วยตัวเลข (ขั้นสูง)
                    </Box>
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <TextField
                        label="ลำดับกลุ่ม"
                        type="number"
                        fullWidth
                        value={positionForm.groupSortOrder}
                        disabled={busy}
                        onChange={(event) => {
                          const groupSortOrder = Number(event.target.value);
                          const sortOrder = positionEditing
                            ? positionForm.sortOrder
                            : nextOrganizationSortOrder(
                                positions.filter(
                                  (position) =>
                                    position.unit_content_id === positionForm.unitContentId &&
                                    position.group_label === positionForm.groupLabel &&
                                    position.group_sort_order === groupSortOrder
                                ),
                                (position) => position.sort_order
                              );
                          setPositionForm({ ...positionForm, groupSortOrder, sortOrder });
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={positionAutoOrder}
                            disabled={busy || Boolean(positionEditing)}
                            onChange={(_, checked) => setPositionAutoOrder(checked)}
                          />
                        }
                        label="เพิ่มต่อท้ายอัตโนมัติจากข้อมูลบนเซิร์ฟเวอร์"
                      />
                      <TextField
                        label="ลำดับตำแหน่ง"
                        type="number"
                        fullWidth
                        value={positionAutoOrder ? "" : positionForm.sortOrder}
                        disabled={busy || positionAutoOrder}
                        helperText={positionAutoOrder ? "เซิร์ฟเวอร์กำหนดลำดับจริงเมื่อบันทึก" : "ค่าในระบบเริ่มที่ 0 แต่รายการแสดงอันดับเริ่มที่ 1"}
                        onChange={(event) =>
                          setPositionForm({ ...positionForm, sortOrder: Number(event.target.value) })
                        }
                      />
                    </Stack>
                  </Box>
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
                    ลากการ์ดเพื่อจัดลำดับได้หลังบันทึก หรือใช้ตัวเลขในขั้นสูง
                    ระบบกำหนดลำดับต่อท้ายให้อัตโนมัติเมื่อเพิ่มตำแหน่ง
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
                    label="ค้นหาบุคลากรในทะเบียนกลาง"
                    value={personnelSearch}
                    onChange={(event) => setPersonnelSearch(event.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 160 } }}
                    helperText="ค้นหาผ่านเซิร์ฟเวอร์โดยไม่ต้องโหลดบุคลากรทั้งหมด"
                  />
                  <TextField
                    label="บุคลากรจากทะเบียนกลาง"
                    select
                    fullWidth
                    required
                    disabled={busy}
                    value={assignmentForm.personnelId}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, personnelId: event.target.value })}
                  >
                    {assignmentForm.personnelId &&
                      !personnelOptions.some((person) => person.id === assignmentForm.personnelId) && (
                        <MenuItem value={assignmentForm.personnelId} disabled>
                          รหัสบุคลากร {assignmentForm.personnelId} (ยังไม่ได้โหลดข้อมูล)
                        </MenuItem>
                      )}
                    {personnelOptions.map((person) => (
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
                    onChange={(event) => {
                      const positionId = event.target.value;
                      const sortOrder = assignmentEditing
                        ? assignmentForm.sortOrder
                        : nextOrganizationSortOrder(
                            assignmentsByPosition.get(positionId) ?? [],
                            (item) => item.sort_order
                          );
                      setAssignmentForm({ ...assignmentForm, positionId, sortOrder });
                    }}
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
                  <Box
                    component="details"
                    sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}
                  >
                    <Box component="summary" sx={{ cursor: "pointer", fontWeight: 600 }}>
                      ตั้งค่าลำดับด้วยตัวเลข (ขั้นสูง)
                    </Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={assignmentAutoOrder}
                          disabled={busy || Boolean(assignmentEditing)}
                          onChange={(_, checked) => setAssignmentAutoOrder(checked)}
                        />
                      }
                      label="เพิ่มต่อท้ายอัตโนมัติจากข้อมูลบนเซิร์ฟเวอร์"
                    />
                    <TextField
                      label="ลำดับการแสดง"
                      type="number"
                      fullWidth
                      sx={{ mt: 2 }}
                      disabled={busy || assignmentAutoOrder}
                      value={assignmentAutoOrder ? "" : assignmentForm.sortOrder}
                      helperText={assignmentAutoOrder ? "เซิร์ฟเวอร์กำหนดลำดับจริงเมื่อบันทึก" : "ระบบแสดงอันดับเริ่มที่ 1"}
                      onChange={(event) =>
                        setAssignmentForm({ ...assignmentForm, sortOrder: Number(event.target.value) })
                      }
                    />
                  </Box>
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
