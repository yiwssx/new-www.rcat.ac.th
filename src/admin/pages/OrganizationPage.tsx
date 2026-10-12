import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useAuth } from "../../context/authSessionContext";
import { hasCmsCapability } from "../../features/cms-auth";
import {
  createOrganizationRecord,
  getOrganizationCollection,
  deleteOrganizationRecord,
  invalidateOrganizationQueries,
  organizationCollectionQueryOptions,
  updateOrganizationRecord,
  type OrganizationUnitListRow,
  type OrganizationUnitWrite
} from "../../features/organization-admin";
import { isAdminStaleRevisionError } from "../../features/admin-write/errors";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import OrganizationUnitEditorDialog from "../components/OrganizationUnitEditorDialog";
import OrganizationPersonnelDirectory from "../components/OrganizationPersonnelDirectory";
import OrganizationBuilder from "../components/OrganizationBuilder";
import { ORGANIZATION_KIND_LABELS, ORGANIZATION_STATUS_LABELS } from "./organizationEditorModel";

function humanError(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง";
}

export type OrganizationManagementView =
  "overview" | "units" | "personnel" | "positions" | "assignments" | "charts" | "legacy";

export default function OrganizationPage({ view = "legacy" }: { view?: OrganizationManagementView }) {
  const { capabilities } = useAuth();
  const canManage = hasCmsCapability(capabilities, "organization.manage");
  const canBrowseMedia = hasCmsCapability(capabilities, "media.read");
  const client = useQueryClient();
  const showUnits = view === "units" || view === "legacy";
  const showBuilder = view === "positions" || view === "assignments" || view === "charts" || view === "legacy";
  const showOverview = view === "overview" || view === "legacy";
  const needUnits = showUnits || showBuilder;
  const units = useInfiniteQuery({
    queryKey: ["admin-organization", "units", "pages"],
    enabled: needUnits,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getOrganizationCollection("units", 100, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined
  });
  const unitsSummary = useQuery({ ...organizationCollectionQueryOptions("units", 1, true), enabled: showOverview });
  const personnel = useQuery({ ...organizationCollectionQueryOptions("personnel", 1, true), enabled: showOverview });
  const positions = useQuery({ ...organizationCollectionQueryOptions("positions", 1, true), enabled: showOverview });
  const assignments = useQuery({
    ...organizationCollectionQueryOptions("assignments", 1, true),
    enabled: showOverview
  });
  const rows = useMemo(() => units.data?.pages.flatMap((page) => page.items) ?? [], [units.data]);
  const collections = [
    {
      label: "หน่วยงาน",
      count: unitsSummary.data?.total ?? rows.length,
      isPending: unitsSummary.isPending,
      isError: unitsSummary.isError
    },
    {
      label: "บุคลากร",
      count: personnel.data?.total ?? personnel.data?.items.length ?? 0,
      isPending: personnel.isPending,
      isError: personnel.isError
    },
    {
      label: "ตำแหน่ง",
      count: positions.data?.total ?? positions.data?.items.length ?? 0,
      isPending: positions.isPending,
      isError: positions.isError
    },
    {
      label: "การมอบหมายหน้าที่",
      count: assignments.data?.total ?? assignments.data?.items.length ?? 0,
      isPending: assignments.isPending,
      isError: assignments.isError
    }
  ];

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<OrganizationUnitListRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [success, setSuccess] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("th");
    return rows
      .filter(
        (unit) => !term || [unit.title, unit.slug, unit.unit_kind].some((s) => s.toLocaleLowerCase("th").includes(term))
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "th"));
  }, [rows, search]);
  const unitRanks = useMemo(() => {
    const ranks = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const unit of [...rows].sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.title.localeCompare(b.title, "th") || a.content_id.localeCompare(b.content_id)
    )) {
      const parent = unit.parent_content_id ?? "";
      const rank = (counts.get(parent) ?? 0) + 1;
      counts.set(parent, rank);
      ranks.set(unit.content_id, rank);
    }
    return ranks;
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: async (input: OrganizationUnitWrite) => {
      if (editing) {
        if (editing.content_revision !== editing.unit_revision)
          throw new Error("Revision ไม่ตรงกัน กรุณาโหลดข้อมูลใหม่");
        await updateOrganizationRecord("units", editing.content_id, editing.content_revision, input);
      } else {
        await createOrganizationRecord("units", input);
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (unit: OrganizationUnitListRow) => {
      if (unit.content_revision !== unit.unit_revision) throw new Error("Revision ไม่ตรงกัน กรุณาโหลดข้อมูลใหม่");
      await deleteOrganizationRecord("units", unit.content_id, unit.content_revision);
    }
  });

  function startCreate() {
    if (!canManage || units.hasNextPage || units.isPending || units.isError) return;
    setEditing(null);
    setEditorError("");
    setError("");
    setEditorOpen(true);
  }

  function startEdit(row: OrganizationUnitListRow) {
    if (!canManage) return;
    setEditing(row);
    setEditorError("");
    setError("");
    setEditorOpen(true);
  }

  async function handleSave(input: OrganizationUnitWrite) {
    if (!canManage || saveMutation.isPending) return;
    setEditorError("");
    setError("");
    setSuccess("");
    const wasEditing = Boolean(editing);
    showBlockingLoading("กำลังบันทึกหน่วยงาน");
    try {
      await saveMutation.mutateAsync(input);
    } catch (cause) {
      await appSwal.close();
      const stale = isAdminStaleRevisionError(cause);
      const message = stale
        ? "ข้อมูลหน่วยงานถูกเปลี่ยนโดยผู้อื่น กรุณาคัดลอกข้อมูลที่แก้ไขไว้แล้วปิดฟอร์มเพื่อเปิดข้อมูลล่าสุด"
        : humanError(cause);
      setEditorError(message);
      if (stale) {
        void invalidateOrganizationQueries(client);
      }
      await showErrorResult("บันทึกหน่วยงานไม่สำเร็จ", new Error(message), "กรุณาลองอีกครั้ง");
      return;
    }
    await invalidateOrganizationQueries(client).catch(() => {
      setError("บันทึกสำเร็จแล้ว แต่โหลดรายการหน่วยงานล่าสุดไม่สำเร็จ กรุณารีเฟรช");
    });
    setEditorOpen(false);
    setEditing(null);
    setSuccess(wasEditing ? "บันทึกการแก้ไขหน่วยงานแล้ว" : "เพิ่มหน่วยงานเรียบร้อยแล้ว");
    await appSwal.close();
    await showSuccessResult(
      "บันทึกหน่วยงานสำเร็จ",
      wasEditing ? "บันทึกการแก้ไขหน่วยงานแล้ว" : "เพิ่มหน่วยงานในระบบแล้ว"
    );
  }

  async function handleDelete(unit: OrganizationUnitListRow) {
    if (!canManage || deleteMutation.isPending) return;
    const confirmation = await appSwal.fire({
      title: "ลบหน่วยงานนี้?",
      text: `ต้องการลบ "${unit.title}" หรือไม่? หากมีหน่วยงานลูกหรือตำแหน่งที่เชื่อมอยู่ ระบบจะไม่อนุญาตให้ลบ`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันลบ",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmation.isConfirmed) return;
    setError("");
    setSuccess("");
    showBlockingLoading("กำลังลบหน่วยงาน");
    try {
      await deleteMutation.mutateAsync(unit);
    } catch (cause) {
      await appSwal.close();
      const message = isAdminStaleRevisionError(cause)
        ? "ข้อมูลหน่วยงานเปลี่ยนแปลงแล้ว กรุณาตรวจสอบข้อมูลล่าสุดก่อนลบ"
        : humanError(cause);
      setError(message);
      await invalidateOrganizationQueries(client);
      await showErrorResult("ลบหน่วยงานไม่สำเร็จ", new Error(message), "กรุณาลองอีกครั้ง");
      return;
    }
    await invalidateOrganizationQueries(client).catch(() => {
      setError("ลบสำเร็จแล้ว แต่โหลดรายการล่าสุดไม่สำเร็จ กรุณารีเฟรช");
    });
    setSuccess("ลบหน่วยงานแล้ว");
    await appSwal.close();
    await showSuccessResult("ลบหน่วยงานสำเร็จ");
  }

  return (
    <Stack spacing={3} sx={{ width: "100%", minWidth: 0 }}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AccountTreeOutlinedIcon color="primary" />
          <Typography variant="h1" sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }}>
            {view === "overview"
              ? "ภาพรวมองค์กร"
              : view === "units"
                ? "จัดการหน่วยงาน"
                : view === "personnel"
                  ? "ทะเบียนบุคลากร"
                  : view === "positions"
                    ? "จัดการตำแหน่ง"
                    : view === "assignments"
                      ? "มอบหมายหน้าที่"
                      : view === "charts"
                        ? "จัดผังองค์กร"
                        : "ผังองค์กร"}
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          จัดการหน่วยงานแยกจากเนื้อหาทั่วไป โดยระบบตรวจสอบสิทธิ์และ Revision ก่อนบันทึก
        </Typography>
      </Box>
      {!canManage && (
        <Alert severity="info">บัญชีนี้มีสิทธิ์อ่านข้อมูลผังองค์กร แต่ไม่สามารถเปลี่ยนแปลงข้อมูลได้</Alert>
      )}
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" role="status">
          {success}
        </Alert>
      )}
      {showOverview && (
        <Grid container spacing={2}>
          {collections.map(({ label, count, isPending, isError }) => (
            <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    {label}
                  </Typography>
                  <Typography variant="h3" sx={{ mt: 1, fontWeight: 700 }}>
                    {isPending ? "…" : isError ? "—" : count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(label === "หน่วยงาน"
                      ? unitsSummary.data
                      : label === "บุคลากร"
                        ? personnel.data
                        : label === "ตำแหน่ง"
                          ? positions.data
                          : assignments.data
                    )?.total !== undefined
                      ? "จำนวนทั้งหมดในระบบ"
                      : "จำนวนตัวอย่างที่โหลด"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      {showUnits && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
              >
                <Typography variant="h2" sx={{ fontSize: "1.25rem" }}>
                  รายการหน่วยงาน
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Button
                    startIcon={<RefreshOutlinedIcon />}
                    onClick={() => void units.refetch()}
                    disabled={units.isFetching}
                  >
                    รีเฟรช
                  </Button>
                  {canManage && (
                    <Button
                      variant="contained"
                      startIcon={<AddOutlinedIcon />}
                      onClick={startCreate}
                      disabled={units.hasNextPage || units.isPending || units.isError}
                    >
                      เพิ่มหน่วยงาน
                    </Button>
                  )}
                </Stack>
              </Stack>
              <TextField
                label="ค้นหาชื่อ, Slug หรือประเภทหน่วยงาน"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 160 } }}
              />
              {units.hasNextPage && canManage && (
                <Alert severity="info">
                  โหลดหน่วยงานเพิ่มเติมให้ครบก่อนเพิ่มรายการ เพื่อคำนวณลำดับต่อท้ายได้ถูกต้อง
                </Alert>
              )}
              {units.isPending && <Typography role="status">กำลังโหลดหน่วยงาน…</Typography>}
              {units.isError && <Alert severity="error">โหลดรายการหน่วยงานไม่สำเร็จ กรุณาลองใหม่</Alert>}
              {rows.length === 0 && !units.isPending && !units.isError && (
                <Alert severity="info">ยังไม่มีข้อมูลหน่วยงาน</Alert>
              )}
              {rows.length > 0 && filtered.length === 0 && (
                <Typography color="text.secondary">ไม่พบหน่วยงานที่ตรงกับคำค้น</Typography>
              )}
              {filtered.map((unit) => (
                <Box key={unit.content_id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                        <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{unit.title}</Typography>
                        <Chip
                          size="small"
                          label={
                            ORGANIZATION_KIND_LABELS[unit.unit_kind as keyof typeof ORGANIZATION_KIND_LABELS] ??
                            unit.unit_kind
                          }
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          color={unit.status === "published" ? "success" : "default"}
                          label={ORGANIZATION_STATUS_LABELS[unit.status] ?? unit.status}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere", mt: 0.5 }}>
                        /{unit.slug} · อันดับ {unitRanks.get(unit.content_id) ?? 1}
                        {unit.parent_content_id
                          ? ` · อยู่ภายใต้ ${rows.find((item) => item.content_id === unit.parent_content_id)?.title ?? "หน่วยงานอื่น"}`
                          : ""}
                      </Typography>
                    </Box>
                    {canManage && (
                      <Stack direction="row" spacing={1}>
                        <Button
                          startIcon={<EditOutlinedIcon />}
                          onClick={() => startEdit(unit)}
                          disabled={saveMutation.isPending || deleteMutation.isPending}
                        >
                          แก้ไข
                        </Button>
                        <Button
                          startIcon={<DeleteOutlineOutlinedIcon />}
                          color="error"
                          onClick={() => void handleDelete(unit)}
                          disabled={saveMutation.isPending || deleteMutation.isPending}
                        >
                          ลบ
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              ))}
              {units.hasNextPage && (
                <Button
                  variant="outlined"
                  onClick={() => void units.fetchNextPage()}
                  disabled={units.isFetchingNextPage}
                >
                  {units.isFetchingNextPage ? "กำลังโหลดเพิ่มเติม…" : "โหลดหน่วยงานเพิ่มเติม"}
                </Button>
              )}
              {units.isFetchNextPageError && <Alert severity="error">โหลดหน้าถัดไปไม่สำเร็จ กรุณาลองใหม่</Alert>}
            </Stack>
          </CardContent>
        </Card>
      )}
      {(view === "personnel" || view === "legacy") && (
        <OrganizationPersonnelDirectory canManage={canManage} canBrowseMedia={canBrowseMedia} />
      )}
      {showBuilder && !showUnits && units.hasNextPage && (
        <Button variant="outlined" onClick={() => void units.fetchNextPage()} disabled={units.isFetchingNextPage}>
          {units.isFetchingNextPage ? "กำลังโหลดหน่วยงาน…" : "โหลดหน่วยงานเพิ่มเติม"}
        </Button>
      )}
      {showBuilder && (
        <OrganizationBuilder
          units={rows}
          allUnitsLoaded={!units.hasNextPage && !units.isPending && !units.isError}
          canManage={canManage}
          onEditUnit={startEdit}
          view={view === "positions" || view === "assignments" || view === "charts" ? view : "legacy"}
        />
      )}
      {canManage && needUnits && (
        <OrganizationUnitEditorDialog
          open={editorOpen}
          initial={editing}
          units={rows}
          busy={saveMutation.isPending}
          error={editorError}
          onClose={() => {
            if (!saveMutation.isPending) {
              setEditorOpen(false);
              setEditing(null);
            }
          }}
          onSave={handleSave}
        />
      )}
    </Stack>
  );
}
