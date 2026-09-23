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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/authSessionContext";
import ResponsiveDialogActions from "../../design-system/components/ResponsiveDialogActions";
import { getAdminCmsSnapshotFromCloudflare } from "../../features/admin-write/cloudflareApi";
import { invalidateAdminListQueries } from "../../features/admin-pagination";
import {
  getContentTrash,
  restoreContentFromTrash,
  setContentWorkflowStatus,
  type EditorialContentItem,
  type EditorialWorkflowStatus
} from "../../features/cms-governance/client";
import type { ContentItem } from "../../features/public-content/types";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { contentStatusLabels } from "../../utils/thaiLabels";
import { formatDisplayDate } from "../../utils/dateDisplay";
import { appSwal } from "../../utils/swal";

const CONTENT_GOVERNANCE_OPTIONS_QUERY = ["cms-governance", "content-options"] as const;
const CONTENT_TRASH_QUERY = ["cms-governance", "content-trash"] as const;

function statusLabel(status: string) {
  return contentStatusLabels[status as keyof typeof contentStatusLabels] || status;
}

export default function EditorialWorkflowPanel() {
  const queryClient = useQueryClient();
  const { hasCapability } = useAuth();
  const canUpdate = hasCapability("content.update");
  const [selectedId, setSelectedId] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [panelError, setPanelError] = useState("");

  const optionsQuery = useQuery({
    queryKey: CONTENT_GOVERNANCE_OPTIONS_QUERY,
    queryFn: getAdminCmsSnapshotFromCloudflare,
    staleTime: 30_000
  });
  const options = useMemo(
    () => [...(optionsQuery.data?.content ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [optionsQuery.data?.content]
  );
  const selected = options.find((item) => item.id === selectedId) ?? null;

  const trashQuery = useQuery({
    queryKey: CONTENT_TRASH_QUERY,
    queryFn: getContentTrash,
    enabled: trashOpen,
    staleTime: 5_000
  });

  const workflowMutation = useMutation({
    mutationFn: ({ item, status }: { item: ContentItem; status: EditorialWorkflowStatus }) =>
      setContentWorkflowStatus(item.id, status, item.revision),
    onSuccess: async (item) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONTENT_GOVERNANCE_OPTIONS_QUERY }),
        invalidateAdminListQueries(queryClient, "content"),
        invalidatePublicCmsData(queryClient)
      ]);
      setSelectedId(item.id);
    }
  });

  const restoreMutation = useMutation({
    mutationFn: (item: EditorialContentItem) => restoreContentFromTrash(item.id, item.revision),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CONTENT_TRASH_QUERY }),
        queryClient.invalidateQueries({ queryKey: CONTENT_GOVERNANCE_OPTIONS_QUERY }),
        invalidateAdminListQueries(queryClient, "content"),
        invalidatePublicCmsData(queryClient)
      ]);
    }
  });

  async function changeWorkflowStatus(status: EditorialWorkflowStatus) {
    if (!selected || !canUpdate || workflowMutation.isPending) return;
    const toReview = status === "review";
    const confirmation = await appSwal.fire({
      icon: "question",
      title: toReview ? "ส่งเนื้อหาเข้าตรวจทาน?" : "นำกลับเป็นฉบับร่าง?",
      text: selected.title,
      showCancelButton: true,
      confirmButtonText: toReview ? "ส่งตรวจ" : "กลับเป็นฉบับร่าง",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmation.isConfirmed) return;

    setPanelError("");
    try {
      await workflowMutation.mutateAsync({ item: selected, status });
      await appSwal.fire({
        icon: "success",
        title: toReview ? "ส่งเข้าตรวจทานแล้ว" : "นำกลับเป็นฉบับร่างแล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะงานบรรณาธิการได้");
    }
  }

  async function restoreFromTrash(item: EditorialContentItem) {
    if (!canUpdate || restoreMutation.isPending) return;
    const confirmation = await appSwal.fire({
      icon: "question",
      title: "กู้คืนเนื้อหานี้?",
      text: `${item.title} จะถูกกู้คืนเป็นฉบับร่าง`,
      showCancelButton: true,
      confirmButtonText: "กู้คืน",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmation.isConfirmed) return;

    try {
      await restoreMutation.mutateAsync(item);
      await appSwal.fire({ icon: "success", title: "กู้คืนเนื้อหาแล้ว", confirmButtonText: "ตกลง" });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถกู้คืนเนื้อหาได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
              Editorial Workflow และถังขยะ
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              ส่งฉบับร่างเข้าตรวจทาน นำงานกลับมาแก้ไข และกู้คืนเนื้อหาที่ลบแบบ soft-delete
            </Typography>
          </Box>

          {panelError && <Alert severity="error">{panelError}</Alert>}
          {optionsQuery.isError && <Alert severity="warning">ไม่สามารถโหลดรายการเนื้อหาได้</Alert>}

          <Autocomplete
            options={options}
            value={selected}
            onChange={(_, value) => setSelectedId(value?.id || "")}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="เลือกเนื้อหาสำหรับ Workflow" />}
          />

          {selected && (
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Chip label={statusLabel(selected.status)} size="small" color="primary" variant="outlined" />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                แก้ไขล่าสุด {formatDisplayDate(selected.updatedAt)}
              </Typography>
            </Stack>
          )}

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button
              variant="contained"
              startIcon={<FactCheckOutlinedIcon />}
              disabled={!canUpdate || selected?.status !== "draft" || workflowMutation.isPending}
              onClick={() => void changeWorkflowStatus("review")}
            >
              ส่งเข้าตรวจทาน
            </Button>
            <Button
              variant="outlined"
              startIcon={<RestoreOutlinedIcon />}
              disabled={!canUpdate || selected?.status !== "review" || workflowMutation.isPending}
              onClick={() => void changeWorkflowStatus("draft")}
            >
              กลับเป็นฉบับร่าง
            </Button>
            <Button variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={() => setTrashOpen(true)}>
              ถังขยะ
            </Button>
          </Stack>

          {selected && !["draft", "review"].includes(selected.status) && (
            <Alert severity="info">
              เนื้อหาสถานะ {statusLabel(selected.status)} ต้องยกเลิกการเผยแพร่ก่อนจึงจะย้อนกลับเข้าสู่ Editorial
              Workflow ได้
            </Alert>
          )}
        </Stack>
      </CardContent>

      <Dialog
        open={trashOpen}
        onClose={restoreMutation.isPending ? undefined : () => setTrashOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>ถังขยะเนื้อหา</DialogTitle>
        <DialogContent dividers>
          {trashQuery.isLoading && <Typography>กำลังโหลดรายการที่ลบ…</Typography>}
          {trashQuery.isError && <Alert severity="error">ไม่สามารถโหลดถังขยะได้</Alert>}
          {trashQuery.data && !trashQuery.data.items.length && <Alert severity="info">ยังไม่มีเนื้อหาในถังขยะ</Alert>}
          <Stack divider={<Divider flexItem />} spacing={0}>
            {trashQuery.data?.items.map((item) => (
              <Stack
                key={item.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ py: 1.5, justifyContent: "space-between", alignItems: { sm: "center" } }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{item.title}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    เดิมเป็น {statusLabel(item.status)} · ลบเมื่อ {formatDisplayDate(item.deletedAt)}
                  </Typography>
                </Box>
                {canUpdate && (
                  <Button
                    size="small"
                    startIcon={<RestoreOutlinedIcon />}
                    disabled={restoreMutation.isPending}
                    onClick={() => void restoreFromTrash(item)}
                  >
                    กู้คืนเป็นฉบับร่าง
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <ResponsiveDialogActions>
          <Button disabled={restoreMutation.isPending} onClick={() => setTrashOpen(false)}>
            ปิด
          </Button>
        </ResponsiveDialogActions>
      </Dialog>
    </Card>
  );
}
