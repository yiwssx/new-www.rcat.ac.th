import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  deleteOrganizationRecord,
  invalidateOrganizationQueries,
  organizationCollectionQueryOptions,
  updateOrganizationRecord,
  type OrganizationUnitListRow,
  type OrganizationUnitWrite
} from "../../features/organization-admin";
import { isAdminStaleRevisionError } from "../../features/admin-write/errors";
import { appSwal } from "../../utils/swal";
import OrganizationUnitEditorDialog from "../components/OrganizationUnitEditorDialog";
import { ORGANIZATION_KIND_LABELS, ORGANIZATION_STATUS_LABELS } from "./organizationEditorModel";

function humanError(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง";
}

export default function OrganizationPage() {
  const { capabilities } = useAuth();
  const canManage = hasCmsCapability(capabilities, "organization.manage");
  const client = useQueryClient();
  const units = useQuery(organizationCollectionQueryOptions("units"));
  const personnel = useQuery(organizationCollectionQueryOptions("personnel"));
  const positions = useQuery(organizationCollectionQueryOptions("positions"));
  const assignments = useQuery(organizationCollectionQueryOptions("assignments"));
  const collections = [
    { label: "หน่วยงาน", query: units },
    { label: "บุคลากร", query: personnel },
    { label: "ตำแหน่ง", query: positions },
    { label: "การมอบหมายหน้าที่", query: assignments }
  ];

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<OrganizationUnitListRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [success, setSuccess] = useState("");
  const rows = units.data?.items ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("th");
    return rows
      .filter((unit) => !term || [unit.title, unit.slug, unit.unit_kind].some((s) => s.toLocaleLowerCase("th").includes(term)))
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "th"));
  }, [rows, search]);

  const saveMutation = useMutation({
    mutationFn: async (input: OrganizationUnitWrite) => {
      if (editing) {
        if (editing.content_revision !== editing.unit_revision) throw new Error("Revision ไม่ตรงกัน กรุณาโหลดข้อมูลใหม่");
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
    if (!canManage) return;
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
    if (!canManage) return;
    setEditorError("");
    setError("");
    setSuccess("");
    try {
      const wasEditing = Boolean(editing);
      await saveMutation.mutateAsync(input);
      await invalidateOrganizationQueries(client);
      setEditorOpen(false);
      setEditing(null);
      setSuccess(wasEditing ? "บันทึกการแก้ไขหน่วยงานแล้ว" : "เพิ่มหน่วยงานเรียบร้อยแล้ว");
    } catch (cause) {
      if (isAdminStaleRevisionError(cause)) {
        setEditorOpen(false);
        setEditing(null);
        setError("ข้อมูลหน่วยงานถูกเปลี่ยนโดยผู้อื่น ระบบกำลังโหลดข้อมูลล่าสุด โปรดเปิดแก้ไขใหม่");
        await invalidateOrganizationQueries(client);
      } else {
        setEditorError(humanError(cause));
      }
    }
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
    try {
      await deleteMutation.mutateAsync(unit);
      await invalidateOrganizationQueries(client);
      setSuccess("ลบหน่วยงานแล้ว");
    } catch (cause) {
      setError(isAdminStaleRevisionError(cause)
        ? "ข้อมูลหน่วยงานเปลี่ยนแปลงแล้ว กรุณาตรวจสอบข้อมูลล่าสุดก่อนลบ"
        : humanError(cause));
      await invalidateOrganizationQueries(client);
    }
  }

  return (
    <Stack spacing={3} sx={{ width: "100%", minWidth: 0 }}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AccountTreeOutlinedIcon color="primary" />
          <Typography variant="h1" sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }}>
            ผังองค์กร
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          จัดการหน่วยงานแยกจากเนื้อหาทั่วไป โดยระบบตรวจสอบสิทธิ์และ Revision ก่อนบันทึก
        </Typography>
      </Box>
      {!canManage && <Alert severity="info">บัญชีนี้มีสิทธิ์อ่านข้อมูลผังองค์กร แต่ไม่สามารถเปลี่ยนแปลงข้อมูลได้</Alert>}
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      {success && <Alert severity="success" role="status">{success}</Alert>}
      <Grid container spacing={2}>
        {collections.map(({ label, query }) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">{label}</Typography>
                <Typography variant="h3" sx={{ mt: 1, fontWeight: 700 }}>
                  {query.isPending ? "…" : query.isError ? "—" : query.data.items.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">จำนวนที่โหลด (สูงสุด 100 รายการ)</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} gap={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Typography variant="h2" sx={{ fontSize: "1.25rem" }}>รายการหน่วยงาน</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button startIcon={<RefreshOutlinedIcon />} onClick={() => void units.refetch()} disabled={units.isFetching}>รีเฟรช</Button>
                {canManage && <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={startCreate}>เพิ่มหน่วยงาน</Button>}
              </Stack>
            </Stack>
            <TextField
              label="ค้นหาชื่อ, Slug หรือประเภทหน่วยงาน" value={search}
              onChange={(event) => setSearch(event.target.value)} fullWidth
              slotProps={{ htmlInput: { maxLength: 160 } }}
            />
            {units.isPending && <Typography role="status">กำลังโหลดหน่วยงาน…</Typography>}
            {units.isError && <Alert severity="error">โหลดรายการหน่วยงานไม่สำเร็จ กรุณาลองใหม่</Alert>}
            {rows.length === 0 && !units.isPending && !units.isError && <Alert severity="info">ยังไม่มีข้อมูลหน่วยงาน</Alert>}
            {rows.length > 0 && filtered.length === 0 && <Typography color="text.secondary">ไม่พบหน่วยงานที่ตรงกับคำค้น</Typography>}
            {filtered.map((unit) => (
              <Box key={unit.content_id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{unit.title}</Typography>
                      <Chip size="small" label={ORGANIZATION_KIND_LABELS[unit.unit_kind as keyof typeof ORGANIZATION_KIND_LABELS] ?? unit.unit_kind} variant="outlined" />
                      <Chip size="small" color={unit.status === "published" ? "success" : "default"}
                        label={ORGANIZATION_STATUS_LABELS[unit.status] ?? unit.status} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere", mt: 0.5 }}>
                      /{unit.slug} · ลำดับ {unit.sort_order}
                      {unit.parent_content_id ? ` · อยู่ภายใต้ ${rows.find((item) => item.content_id === unit.parent_content_id)?.title ?? "หน่วยงานอื่น"}` : ""}
                    </Typography>
                  </Box>
                  {canManage && (
                    <Stack direction="row" spacing={1}>
                      <Button startIcon={<EditOutlinedIcon />} onClick={() => startEdit(unit)} disabled={saveMutation.isPending || deleteMutation.isPending}>แก้ไข</Button>
                      <Button startIcon={<DeleteOutlineOutlinedIcon />} color="error" onClick={() => void handleDelete(unit)} disabled={saveMutation.isPending || deleteMutation.isPending}>ลบ</Button>
                    </Stack>
                  )}
                </Stack>
              </Box>
            ))}
            {rows.length >= 100 && <Alert severity="warning">รายการปัจจุบันแสดงสูงสุด 100 รายการ ต้องเพิ่ม Pagination ก่อนใช้งานกับหน่วยงานจำนวนมาก</Alert>}
          </Stack>
        </CardContent>
      </Card>
      {canManage && (
        <OrganizationUnitEditorDialog
          open={editorOpen}
          initial={editing}
          units={rows}
          busy={saveMutation.isPending}
          error={editorError}
          onClose={() => { if (!saveMutation.isPending) { setEditorOpen(false); setEditing(null); } }}
          onSave={handleSave}
        />
      )}
    </Stack>
  );
}
