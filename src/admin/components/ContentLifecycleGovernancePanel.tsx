import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PreviewOutlinedIcon from "@mui/icons-material/PreviewOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/authSessionContext";
import ResponsiveDialogActions from "../../design-system/components/ResponsiveDialogActions";
import { getAdminCmsSnapshotFromCloudflare } from "../../features/admin-write/cloudflareApi";
import {
  getAuditLog,
  getContentPreview,
  getContentRevisions,
  restoreContentRevision,
  setContentUnpublishAt,
  type ContentRevision
} from "../../features/cms-governance/client";
import { invalidateAdminListQueries } from "../../features/admin-pagination";
import ContentBlocksRenderer from "../../shared/components/ContentBlocksRenderer";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { parseContentBodyToBlocks } from "../../utils/contentBlocks";
import { formatDisplayDate } from "../../utils/dateDisplay";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";
import { appSwal } from "../../utils/swal";

const CONTENT_OPTIONS_QUERY = ["cms-governance", "content-options"] as const;

function revisionReasonLabel(reason: string) {
  if (reason === "publish") return "เผยแพร่";
  if (reason === "unpublish") return "ยกเลิกเผยแพร่";
  if (reason === "delete") return "ลบ";
  return "แก้ไข";
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    create: "สร้าง",
    update: "แก้ไข",
    publish: "เผยแพร่",
    unpublish: "ยกเลิกเผยแพร่",
    archive: "ลบ",
    restore: "กู้คืนเวอร์ชัน",
    "expiry-set": "ตั้งวันสิ้นสุด",
    "expiry-clear": "ยกเลิกวันสิ้นสุด",
    "accessibility-update": "แก้คำอธิบายสื่อ"
  };
  return labels[action] || action;
}

export default function ContentLifecycleGovernancePanel() {
  const queryClient = useQueryClient();
  const { hasCapability } = useAuth();
  const canUpdate = hasCapability("content.update");
  const canAudit = hasCapability("audit.read");
  const [selectedId, setSelectedId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [expiryValue, setExpiryValue] = useState("");
  const [panelError, setPanelError] = useState("");

  const optionsQuery = useQuery({
    queryKey: CONTENT_OPTIONS_QUERY,
    queryFn: getAdminCmsSnapshotFromCloudflare,
    staleTime: 30_000
  });
  const options = useMemo(
    () => [...(optionsQuery.data?.content ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [optionsQuery.data?.content]
  );
  const selected = options.find((item) => item.id === selectedId) ?? null;

  const previewQuery = useQuery({
    queryKey: ["cms-governance", "preview", selectedId],
    queryFn: () => getContentPreview(selectedId),
    enabled: Boolean(selectedId && (previewOpen || expiryOpen)),
    staleTime: 5_000
  });
  const revisionsQuery = useQuery({
    queryKey: ["cms-governance", "revisions", selectedId],
    queryFn: () => getContentRevisions(selectedId),
    enabled: Boolean(selectedId && revisionsOpen),
    staleTime: 5_000
  });
  const auditQuery = useQuery({
    queryKey: ["cms-governance", "audit", auditOpen],
    queryFn: () => getAuditLog({ page: 1, pageSize: 50 }),
    enabled: auditOpen && canAudit,
    staleTime: 10_000
  });

  const restoreMutation = useMutation({
    mutationFn: (revision: ContentRevision) =>
      restoreContentRevision(selectedId, revision.revision, revisionsQuery.data?.currentRevision),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONTENT_OPTIONS_QUERY }),
        queryClient.invalidateQueries({ queryKey: ["cms-governance", "revisions", selectedId] }),
        queryClient.invalidateQueries({ queryKey: ["cms-governance", "preview", selectedId] }),
        invalidateAdminListQueries(queryClient, "content"),
        invalidatePublicCmsData(queryClient)
      ]);
    }
  });

  const expiryMutation = useMutation({
    mutationFn: (unpublishAt: string) =>
      setContentUnpublishAt(selectedId, unpublishAt, previewQuery.data?.item.revision ?? selected?.revision),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONTENT_OPTIONS_QUERY }),
        queryClient.invalidateQueries({ queryKey: ["cms-governance", "preview", selectedId] }),
        invalidateAdminListQueries(queryClient, "content"),
        invalidatePublicCmsData(queryClient)
      ]);
      setExpiryOpen(false);
    }
  });

  async function openExpiry() {
    if (!selectedId) return;
    setPanelError("");
    try {
      const snapshot = await queryClient.fetchQuery({
        queryKey: ["cms-governance", "preview", selectedId],
        queryFn: () => getContentPreview(selectedId),
        staleTime: 0
      });
      setExpiryValue(toLocalDateTimeInputValue(snapshot.item.unpublishAt || ""));
      setExpiryOpen(true);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลกำหนดเวลาได้");
    }
  }

  async function restoreRevision(revision: ContentRevision) {
    const result = await appSwal.fire({
      title: "กู้คืนเวอร์ชันนี้?",
      text: `เวอร์ชัน ${revision.revision} · ${formatDisplayDate(revision.createdAt)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "กู้คืน",
      cancelButtonText: "ยกเลิก"
    });
    if (!result.isConfirmed) return;

    try {
      await restoreMutation.mutateAsync(revision);
      await appSwal.fire({ icon: "success", title: "กู้คืนเวอร์ชันสำเร็จ", confirmButtonText: "ตกลง" });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถกู้คืนเวอร์ชันได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  async function saveExpiry() {
    const iso = expiryValue ? fromLocalDateTimeInputValue(expiryValue) : "";
    if (expiryValue && !iso) {
      setPanelError("วันที่สิ้นสุดการเผยแพร่ไม่ถูกต้อง");
      return;
    }
    setPanelError("");
    try {
      await expiryMutation.mutateAsync(iso);
      await appSwal.fire({
        icon: "success",
        title: expiryValue ? "ตั้งวันสิ้นสุดการเผยแพร่แล้ว" : "ยกเลิกวันสิ้นสุดการเผยแพร่แล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "ไม่สามารถบันทึกกำหนดเวลาได้");
    }
  }

  const preview = previewQuery.data;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
              การควบคุมวงจรเนื้อหา
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              ตรวจตัวอย่าง ย้อนเวอร์ชัน กำหนดวันสิ้นสุดการเผยแพร่ และตรวจประวัติการดำเนินงาน
            </Typography>
          </Box>
          {panelError && <Alert severity="error">{panelError}</Alert>}
          {optionsQuery.isError && <Alert severity="warning">ไม่สามารถโหลดรายการเนื้อหาสำหรับเครื่องมือควบคุมได้</Alert>}
          <Autocomplete
            options={options}
            value={selected}
            onChange={(_, value) => setSelectedId(value?.id || "")}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="เลือกเนื้อหา" placeholder="ค้นหาชื่อเนื้อหา" />}
          />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<PreviewOutlinedIcon />}
              disabled={!selectedId}
              onClick={() => setPreviewOpen(true)}
            >
              ตัวอย่างก่อนเผยแพร่
            </Button>
            <Button
              variant="outlined"
              startIcon={<HistoryOutlinedIcon />}
              disabled={!selectedId}
              onClick={() => setRevisionsOpen(true)}
            >
              ประวัติเวอร์ชัน
            </Button>
            <Button
              variant="outlined"
              startIcon={<ScheduleOutlinedIcon />}
              disabled={!selectedId || !canUpdate}
              onClick={() => void openExpiry()}
            >
              วันสิ้นสุดการเผยแพร่
            </Button>
            {canAudit && (
              <Button variant="outlined" startIcon={<FactCheckOutlinedIcon />} onClick={() => setAuditOpen(true)}>
                Audit Log
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>ตัวอย่างก่อนเผยแพร่</DialogTitle>
        <DialogContent dividers>
          {previewQuery.isLoading && <Typography>กำลังโหลดตัวอย่าง…</Typography>}
          {previewQuery.isError && <Alert severity="error">ไม่สามารถโหลดตัวอย่างได้</Alert>}
          {preview && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Chip label={preview.item.status} size="small" />
                <Chip label={preview.item.type} size="small" variant="outlined" />
              </Stack>
              <Typography variant="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
                {preview.item.title}
              </Typography>
              {preview.item.summary && <Typography sx={{ color: "text.secondary" }}>{preview.item.summary}</Typography>}
              <Divider />
              <ContentBlocksRenderer blocks={parseContentBodyToBlocks(preview.item.body)} mediaAssets={preview.media} />
            </Stack>
          )}
        </DialogContent>
        <ResponsiveDialogActions>
          <Button onClick={() => setPreviewOpen(false)}>ปิด</Button>
        </ResponsiveDialogActions>
      </Dialog>

      <Dialog open={revisionsOpen} onClose={() => setRevisionsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>ประวัติเวอร์ชัน</DialogTitle>
        <DialogContent dividers>
          {revisionsQuery.isLoading && <Typography>กำลังโหลดประวัติ…</Typography>}
          {revisionsQuery.isError && <Alert severity="error">ไม่สามารถโหลดประวัติเวอร์ชันได้</Alert>}
          {revisionsQuery.data && !revisionsQuery.data.items.length && (
            <Alert severity="info">ยังไม่มีเวอร์ชันก่อนหน้าสำหรับเนื้อหานี้</Alert>
          )}
          <Stack divider={<Divider flexItem />} spacing={0}>
            {revisionsQuery.data?.items.map((revision) => (
              <Stack
                key={revision.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ py: 1.5, justifyContent: "space-between", alignItems: { sm: "center" } }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>
                    เวอร์ชัน {revision.revision} · {revision.snapshot?.title || "ไม่มีชื่อเรื่อง"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {revisionReasonLabel(revision.reason)} · {formatDisplayDate(revision.createdAt)} · {revision.actor || "ระบบ"}
                  </Typography>
                </Box>
                {canUpdate && (
                  <Button
                    size="small"
                    startIcon={<RestoreOutlinedIcon />}
                    disabled={restoreMutation.isPending}
                    onClick={() => void restoreRevision(revision)}
                  >
                    กู้คืน
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <ResponsiveDialogActions>
          <Button onClick={() => setRevisionsOpen(false)}>ปิด</Button>
        </ResponsiveDialogActions>
      </Dialog>

      <Dialog open={expiryOpen} onClose={expiryMutation.isPending ? undefined : () => setExpiryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>กำหนดวันสิ้นสุดการเผยแพร่</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              เมื่อถึงเวลาที่กำหนด เนื้อหาจะไม่ปรากฏบนเว็บไซต์สาธารณะโดยอัตโนมัติ โดยยังเก็บสถานะและข้อมูลไว้ใน CMS
            </Alert>
            <TextField
              type="datetime-local"
              label="สิ้นสุดการเผยแพร่"
              value={expiryValue}
              onChange={(event) => setExpiryValue(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <ResponsiveDialogActions>
          <Button onClick={() => setExpiryOpen(false)} disabled={expiryMutation.isPending}>
            ยกเลิก
          </Button>
          <Button variant="contained" onClick={() => void saveExpiry()} disabled={expiryMutation.isPending}>
            บันทึก
          </Button>
        </ResponsiveDialogActions>
      </Dialog>

      <Dialog open={auditOpen} onClose={() => setAuditOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>CMS Audit Log</DialogTitle>
        <DialogContent dividers>
          {auditQuery.isLoading && <Typography>กำลังโหลดประวัติ…</Typography>}
          {auditQuery.isError && <Alert severity="error">ไม่สามารถโหลด Audit Log ได้</Alert>}
          <Stack divider={<Divider flexItem />} spacing={0}>
            {auditQuery.data?.items.map((entry) => (
              <Stack
                key={entry.id}
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ py: 1.25, justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }}>
                    {auditActionLabel(entry.action)} · {entry.entityType}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", overflowWrap: "anywhere" }}>
                    {entry.entityId}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { md: "right" } }}>
                  <Typography variant="body2">{entry.actor || "ระบบ"}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {formatDisplayDate(entry.createdAt)}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <ResponsiveDialogActions>
          <Button onClick={() => setAuditOpen(false)}>ปิด</Button>
        </ResponsiveDialogActions>
      </Dialog>
    </Card>
  );
}
