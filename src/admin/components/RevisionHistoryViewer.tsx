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
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useQuery } from "@tanstack/react-query";
import ResponsiveDialogActions from "../../design-system/components/ResponsiveDialogActions";
import { getAdminCmsSnapshotFromCloudflare } from "../../features/admin-write/cloudflareApi";
import { getContentRevisions, type ContentRevision } from "../../features/cms-governance/client";
import { formatDisplayDate } from "../../utils/dateDisplay";

const CONTENT_OPTIONS_QUERY = ["cms-governance", "content-options"] as const;

export function revisionActionLabel(reason: string) {
  const labels: Record<string, string> = {
    create: "สร้าง",
    update: "แก้ไข",
    publish: "เผยแพร่",
    unpublish: "ยกเลิกเผยแพร่",
    delete: "ลบ",
    restore: "กู้คืน"
  };
  return labels[reason] || reason || "ไม่ระบุ";
}

export function snapshotSummaryRows(revision: ContentRevision) {
  const snapshot = revision.snapshot;
  if (!snapshot) return [];
  return [
    ["ชื่อเรื่อง", snapshot.title || "—"],
    ["Slug", snapshot.slug || "—"],
    ["ประเภท", snapshot.type || "—"],
    ["สถานะ", snapshot.status || "—"],
    ["ผู้รับผิดชอบ", snapshot.owner || "—"],
    ["หมวดหมู่", snapshot.category || "—"],
    ["กำหนดเผยแพร่", snapshot.publishAt ? formatDisplayDate(snapshot.publishAt) : "—"],
    ["กำหนดสิ้นสุด", snapshot.unpublishAt ? formatDisplayDate(snapshot.unpublishAt) : "—"]
  ] as const;
}

export default function RevisionHistoryViewer() {
  const [selectedId, setSelectedId] = useState("");
  const [selectedRevision, setSelectedRevision] = useState<ContentRevision | null>(null);

  const optionsQuery = useQuery({
    queryKey: CONTENT_OPTIONS_QUERY,
    queryFn: getAdminCmsSnapshotFromCloudflare,
    staleTime: 30_000
  });
  const options = useMemo(
    () =>
      [...(optionsQuery.data?.content ?? [])].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      ),
    [optionsQuery.data?.content]
  );
  const selected = options.find((item) => item.id === selectedId) ?? null;
  const revisionsQuery = useQuery({
    queryKey: ["cms-governance", "revisions", selectedId],
    queryFn: () => getContentRevisions(selectedId),
    enabled: Boolean(selectedId),
    staleTime: 5_000
  });

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <HistoryOutlinedIcon color="primary" />
              <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
                ประวัติ Revision
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              ตรวจสอบเวอร์ชัน การดำเนินการ เวลา ผู้ดำเนินการ และ snapshot แบบอ่านอย่างเดียว
            </Typography>
          </Box>

          {optionsQuery.isError && <Alert severity="warning">ไม่สามารถโหลดรายการเนื้อหาได้</Alert>}
          <Autocomplete
            options={options}
            value={selected}
            onChange={(_, value) => {
              setSelectedId(value?.id || "");
              setSelectedRevision(null);
            }}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="เลือกเนื้อหา" placeholder="ค้นหาชื่อเนื้อหา" />}
          />

          {selectedId && revisionsQuery.isLoading && <Typography>กำลังโหลดประวัติ…</Typography>}
          {revisionsQuery.isError && <Alert severity="error">ไม่สามารถโหลดประวัติการแก้ไขได้</Alert>}
          {revisionsQuery.data && !revisionsQuery.data.items.length && (
            <Alert severity="info">ยังไม่มี revision history สำหรับเนื้อหานี้</Alert>
          )}

          {revisionsQuery.data?.items.length ? (
            <Stack divider={<Divider flexItem />} spacing={0}>
              {revisionsQuery.data.items.map((revision) => (
                <Stack
                  key={`${revision.contentId}-${revision.revision}`}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ py: 1.5, justifyContent: "space-between", alignItems: { sm: "center" } }}
                >
                  <Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      sx={{ flexWrap: "wrap", alignItems: "center" }}
                    >
                      <Typography sx={{ fontWeight: 800 }}>Revision {revision.revision}</Typography>
                      <Chip label={revisionActionLabel(revision.reason)} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                      {formatDisplayDate(revision.createdAt)} · {revision.actor || "ระบบ"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {revision.snapshot?.title || "Snapshot ไม่พร้อมใช้งาน"}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VisibilityOutlinedIcon />}
                    disabled={!revision.snapshot}
                    onClick={() => setSelectedRevision(revision)}
                  >
                    ตรวจ Snapshot
                  </Button>
                </Stack>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>

      <Dialog open={Boolean(selectedRevision)} onClose={() => setSelectedRevision(null)} fullWidth maxWidth="md">
        <DialogTitle>Snapshot {selectedRevision ? `Revision ${selectedRevision.revision}` : ""}</DialogTitle>
        <DialogContent dividers>
          {selectedRevision && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Chip label={revisionActionLabel(selectedRevision.reason)} size="small" />
                <Chip label={formatDisplayDate(selectedRevision.createdAt)} size="small" variant="outlined" />
                <Chip label={selectedRevision.actor || "ระบบ"} size="small" variant="outlined" />
              </Stack>
              <Stack divider={<Divider flexItem />} spacing={0}>
                {snapshotSummaryRows(selectedRevision).map(([label, value]) => (
                  <Stack key={label} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ color: "text.secondary", width: { sm: 160 }, flexShrink: 0 }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                      {value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              {selectedRevision.snapshot?.summary && (
                <Box>
                  <Typography variant="subtitle2">สรุป</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                    {selectedRevision.snapshot.summary}
                  </Typography>
                </Box>
              )}
              {selectedRevision.snapshot?.body && (
                <Box>
                  <Typography variant="subtitle2">เนื้อหา Snapshot</Typography>
                  <Box
                    component="pre"
                    sx={{
                      mt: 0.5,
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: "action.hover",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      maxHeight: 360,
                      overflow: "auto"
                    }}
                  >
                    {selectedRevision.snapshot.body}
                  </Box>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <ResponsiveDialogActions>
          <Button onClick={() => setSelectedRevision(null)}>ปิด</Button>
        </ResponsiveDialogActions>
      </Dialog>
    </Card>
  );
}
