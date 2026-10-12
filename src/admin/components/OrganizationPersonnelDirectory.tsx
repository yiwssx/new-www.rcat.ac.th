import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { isAdminStaleRevisionError } from "../../features/admin-write/errors";
import {
  createOrganizationRecord,
  deleteOrganizationRecord,
  getOrganizationCollection,
  invalidateOrganizationQueries,
  updateOrganizationRecord,
  type OrganizationPersonnelRow,
  type OrganizationPersonnelWrite
} from "../../features/organization-admin";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import OrganizationPersonnelEditorDialog from "./OrganizationPersonnelEditorDialog";

interface Props {
  canManage: boolean;
  canBrowseMedia: boolean;
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง";
}

export default function OrganizationPersonnelDirectory({ canManage, canBrowseMedia }: Props) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [editing, setEditing] = useState<OrganizationPersonnelRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const list = useInfiniteQuery({
    queryKey: ["admin-organization", "personnel", "pages", query],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getOrganizationCollection("personnel", 100, pageParam, { includeTotal: true, search: query }),
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined
  });
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  // The server searches across all canonical personnel records, not just the loaded page.
  const visible = rows;
  const total = list.data?.pages[0]?.total;

  const save = useMutation({
    mutationFn: async ({ value, row }: { value: OrganizationPersonnelWrite; row: OrganizationPersonnelRow | null }) =>
      row
        ? updateOrganizationRecord("personnel", row.id, row.revision, value)
        : createOrganizationRecord("personnel", value)
  });
  const remove = useMutation({
    mutationFn: (row: OrganizationPersonnelRow) => deleteOrganizationRecord("personnel", row.id, row.revision)
  });

  function start(row: OrganizationPersonnelRow | null) {
    if (!canManage) return;
    setEditing(row);
    setEditorError("");
    setError("");
    setNotice("");
    setDialogOpen(true);
  }

  async function handleSave(value: OrganizationPersonnelWrite) {
    if (!canManage || save.isPending) return;
    setEditorError("");
    setError("");
    setNotice("");
    const wasEditing = Boolean(editing);
    showBlockingLoading("กำลังบันทึกบุคลากร");
    try {
      await save.mutateAsync({ row: editing, value });
    } catch (cause) {
      await appSwal.close();
      const stale = isAdminStaleRevisionError(cause);
      const message = stale
        ? "ข้อมูลบุคลากรถูกแก้ไขโดยผู้ใช้อื่น กรุณาคัดลอกข้อมูลที่กรอกไว้แล้วปิดฟอร์มเพื่อเปิดข้อมูลล่าสุด"
        : messageFor(cause);
      setEditorError(message);
      if (stale) {
        void invalidateOrganizationQueries(client, "personnel");
      }
      await showErrorResult("บันทึกบุคลากรไม่สำเร็จ", new Error(message), "กรุณาลองอีกครั้ง");
      return;
    }
    await invalidateOrganizationQueries(client, "personnel").catch(() => {
      setError("บันทึกสำเร็จแล้ว แต่โหลดทะเบียนบุคลากรล่าสุดไม่สำเร็จ กรุณารีเฟรช");
    });
    setDialogOpen(false);
    setEditing(null);
    setNotice(wasEditing ? "อัปเดตประวัติบุคลากรแล้ว" : "เพิ่มบุคลากรในทะเบียนกลางแล้ว");
    await appSwal.close();
    await showSuccessResult(
      "บันทึกบุคลากรสำเร็จ",
      wasEditing ? "อัปเดตประวัติบุคลากรแล้ว" : "เพิ่มบุคลากรในทะเบียนกลางแล้ว"
    );
  }

  async function handleRemove(row: OrganizationPersonnelRow) {
    if (!canManage || remove.isPending) return;
    const confirmed = await appSwal.fire({
      title: "ลบบุคลากรจากทะเบียนกลาง?",
      text: `ต้องการลบ "${row.display_name}" หรือไม่? หากมีหน้าที่หรือหน่วยงานที่เชื่อมอยู่ ต้องนำการมอบหมายออกก่อน ระบบจะไม่ลบข้อมูลที่เชื่อมโยงอัตโนมัติ`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันลบ",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmed.isConfirmed) return;
    setError("");
    setNotice("");
    showBlockingLoading("กำลังลบบุคลากร");
    try {
      await remove.mutateAsync(row);
    } catch (cause) {
      await appSwal.close();
      const message = isAdminStaleRevisionError(cause)
        ? "ข้อมูลบุคลากรถูกแก้ไขโดยผู้ใช้อื่น กรุณาตรวจสอบข้อมูลล่าสุดก่อนลบ"
        : messageFor(cause);
      setError(message);
      await invalidateOrganizationQueries(client, "personnel");
      await showErrorResult("ลบบุคลากรไม่สำเร็จ", new Error(message), "กรุณาลองอีกครั้ง");
      return;
    }
    await invalidateOrganizationQueries(client, "personnel").catch(() => {
      setError("ลบสำเร็จแล้ว แต่โหลดทะเบียนบุคลากรล่าสุดไม่สำเร็จ กรุณารีเฟรช");
    });
    setNotice("ลบข้อมูลบุคลากรจากทะเบียนกลางแล้ว");
    await appSwal.close();
    await showSuccessResult("ลบบุคลากรสำเร็จ");
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
          >
            <Box>
              <Typography variant="h2" sx={{ fontSize: "1.25rem" }}>
                ทะเบียนบุคลากรกลาง
              </Typography>
              <Typography variant="body2" color="text.secondary">
                บุคคลหนึ่งคนใช้ประวัติเดียวกันได้ในหลายฝ่าย งาน และแผนกวิชา
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Button
                startIcon={<RefreshOutlinedIcon />}
                disabled={list.isFetching}
                onClick={() => void list.refetch()}
              >
                รีเฟรช
              </Button>
              {canManage && (
                <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => start(null)}>
                  เพิ่มบุคลากร
                </Button>
              )}
            </Stack>
          </Stack>
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
          <TextField
            label="ค้นหาบุคลากรทั้งหมด"
            placeholder="ชื่อ ประเภทบุคลากร หรือตำแหน่ง"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 160 } }}
          />
          {typeof total === "number" && (
            <Typography variant="body2" color="text.secondary">
              พบ {total} รายการ
            </Typography>
          )}
          {list.isPending && <Typography role="status">กำลังโหลดรายชื่อบุคลากร…</Typography>}
          {list.isError && <Alert severity="error">ไม่สามารถโหลดรายชื่อบุคลากร กรุณาลองใหม่</Alert>}
          {!list.isPending && !list.isError && rows.length === 0 && (
            <Alert severity="info">ยังไม่มีบุคลากรในทะเบียนกลาง</Alert>
          )}
          {rows.length > 0 && visible.length === 0 && (
            <Typography color="text.secondary">ไม่พบบุคลากรที่ตรงกับคำค้น</Typography>
          )}
          {visible.map((row) => (
            <Box key={row.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, minWidth: 0 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
              >
                <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: "center" }}>
                  <Avatar aria-hidden="true">{row.display_name.slice(0, 1)}</Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{row.display_name}</Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ overflowWrap: "anywhere" }}>
                      {[row.personnel_type, row.employment_position].filter(Boolean).join(" · ") ||
                        "ยังไม่ระบุประเภทและตำแหน่ง"}
                    </Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={row.active === 1 ? "ปฏิบัติงาน" : "ไม่ปฏิบัติงาน"}
                        color={row.active === 1 ? "success" : "default"}
                        variant="outlined"
                      />
                      {!!row.photo_media_id && <Chip size="small" label="มีรูปจากคลังสื่อ" variant="outlined" />}
                    </Stack>
                  </Box>
                </Stack>
                {canManage && (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Button
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => start(row)}
                      disabled={save.isPending || remove.isPending}
                    >
                      แก้ไข
                    </Button>
                    <Button
                      startIcon={<DeleteOutlineOutlinedIcon />}
                      color="error"
                      onClick={() => void handleRemove(row)}
                      disabled={save.isPending || remove.isPending}
                    >
                      ลบ
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Box>
          ))}
          {list.hasNextPage && (
            <Button variant="outlined" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? "กำลังโหลดเพิ่มเติม…" : "โหลดบุคลากรเพิ่มเติม"}
            </Button>
          )}
          {list.isFetchNextPageError && <Alert severity="error">โหลดรายชื่อหน้าถัดไปไม่สำเร็จ กรุณาลองใหม่</Alert>}
          {rows.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              แสดง {rows.length} รายการที่โหลดแล้ว (100 รายการต่อหน้า)
            </Typography>
          )}
        </Stack>
      </CardContent>
      {canManage && (
        <OrganizationPersonnelEditorDialog
          open={dialogOpen}
          initial={editing}
          busy={save.isPending}
          error={editorError}
          canBrowseMedia={canBrowseMedia}
          onClose={() => {
            if (!save.isPending) {
              setDialogOpen(false);
              setEditing(null);
            }
          }}
          onSave={handleSave}
        />
      )}
    </Card>
  );
}
