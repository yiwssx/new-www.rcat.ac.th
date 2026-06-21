import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import { getAdminCmsSnapshot } from "../../features/cms-dashboard";
import { deleteDocumentFromApi, saveDocumentToApi, type DocumentItemInput } from "../../features/cms-documents";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { CmsDocumentItem, DocumentStatus } from "../../types";
import { formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { appSwal } from "../../utils/swal";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";

const documentStatusOptions: Array<{ value: DocumentStatus; label: string }> = [
  { value: "draft", label: "ฉบับร่าง" },
  { value: "published", label: "เผยแพร่" }
];

function sortDocuments(items: CmsDocumentItem[]) {
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return Date.parse(right.publishedAt || "") - Date.parse(left.publishedAt || "");
  });
}

function createDocumentDraft(order: number): CmsDocumentItem {
  const now = new Date().toISOString();

  return {
    id: `document-${Date.now()}`,
    title: "",
    description: "",
    category: "",
    fileUrl: "",
    fileName: "",
    mediaId: "",
    publishedAt: "",
    status: "draft",
    order,
    pinned: false,
    updatedAt: now
  };
}

function normalizeDocumentDraft(item: CmsDocumentItem): DocumentItemInput {
  const order = Number(item.order);

  return {
    ...item,
    title: item.title.trim(),
    description: item.description.trim(),
    category: item.category.trim(),
    fileUrl: item.fileUrl.trim(),
    fileName: item.fileName.trim(),
    mediaId: item.mediaId.trim(),
    publishedAt: item.publishedAt || "",
    status: item.status,
    order: Number.isFinite(order) ? order : 0,
    pinned: Boolean(item.pinned)
  };
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const adminSnapshotQuery = useQuery({
    queryKey: ["cms-snapshot", "admin"],
    queryFn: getAdminCmsSnapshot
  });
  const documents = useMemo(
    () => sortDocuments(adminSnapshotQuery.data?.documents ?? []),
    [adminSnapshotQuery.data?.documents]
  );
  const [editingDocument, setEditingDocument] = useState<CmsDocumentItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saveError, setSaveError] = useState("");

  const saveMutation = useMutation({
    mutationFn: saveDocumentToApi
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDocumentFromApi
  });

  async function invalidateDocumentData() {
    await invalidatePublicCmsData(queryClient);
  }

  function updateEditingDocument<K extends keyof CmsDocumentItem>(key: K, value: CmsDocumentItem[K]) {
    setEditingDocument((current) =>
      current
        ? {
            ...current,
            [key]: value
          }
        : current
    );
  }

  function handleAddDocument() {
    setSaveError("");
    setEditingDocument(createDocumentDraft(documents.length + 1));
    setIsCreating(true);
    setDialogOpen(true);
  }

  function handleEditDocument(document: CmsDocumentItem) {
    setSaveError("");
    setEditingDocument({
      ...document,
      publishedAt: document.publishedAt || ""
    });
    setIsCreating(false);
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    if (saveMutation.isPending) {
      return;
    }

    setDialogOpen(false);
    setEditingDocument(null);
    setIsCreating(false);
    setSaveError("");
  }

  async function handleSaveDocument() {
    if (!editingDocument) {
      return;
    }

    const nextDocument = normalizeDocumentDraft(editingDocument);

    if (!nextDocument.title || !nextDocument.fileUrl) {
      setSaveError("กรุณาระบุชื่อเอกสารและลิงก์ไฟล์");
      return;
    }

    try {
      await saveMutation.mutateAsync(nextDocument);
      await invalidateDocumentData();
      handleCloseDialog();
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "บันทึกเอกสารแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "ไม่สามารถบันทึกเอกสารได้");
    }
  }

  async function handleDeleteDocument(document: CmsDocumentItem) {
    const result = await appSwal.fire({
      title: "ลบเอกสารเผยแพร่?",
      text: document.title,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(document.id);
      await invalidateDocumentData();
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ลบเอกสารแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบเอกสารได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="เอกสารเผยแพร่"
        description="จัดการไฟล์เอกสารที่แสดงในหน้าแรกและรายการเอกสารสาธารณะ"
        action={
          <Button startIcon={<AddOutlinedIcon />} variant="contained" onClick={handleAddDocument}>
            เพิ่มเอกสาร
          </Button>
        }
      />

      {adminSnapshotQuery.isLoading && <LinearProgress sx={{ mb: 2 }} />}
      {adminSnapshotQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {adminSnapshotQuery.error instanceof Error
            ? adminSnapshotQuery.error.message
            : "ไม่สามารถโหลดรายการเอกสารได้"}
        </Alert>
      )}

      <Card className="rcat-card">
        <CardContent sx={{ p: 0 }}>
          <Box className="table-scroll">
            <MuiTable>
              <TableHead>
                <TableRow>
                  <TableCell>เอกสาร</TableCell>
                  <TableCell>หมวดหมู่</TableCell>
                  <TableCell>สถานะ</TableCell>
                  <TableCell>ลำดับ</TableCell>
                  <TableCell>วันที่เผยแพร่</TableCell>
                  <TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <DescriptionOutlinedIcon color="primary" sx={{ mt: 0.4 }} />
                        <Box>
                          <Typography fontWeight={800}>{document.title || "ไม่มีชื่อเอกสาร"}</Typography>
                          <Typography color="text.secondary" variant="body2" className="content-summary">
                            {document.description || document.fileName || document.fileUrl}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{document.category || "-"}</TableCell>
                    <TableCell>
                      <StatusChip status={document.status} />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography>{document.order}</Typography>
                        {document.pinned && (
                          <Typography color="secondary.dark" variant="caption">
                            ปักหมุด
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{document.publishedAt ? formatDisplayDateTime(document.publishedAt) : "-"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="เปิดไฟล์">
                        <span>
                          <IconButton
                            component="a"
                            href={normalizeSafeHref(document.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            disabled={!document.fileUrl}
                          >
                            <OpenInNewOutlinedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="แก้ไข">
                        <IconButton onClick={() => handleEditDocument(document)}>
                          <EditOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="ลบ">
                        <IconButton color="error" onClick={() => void handleDeleteDocument(document)}>
                          <DeleteOutlineOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!documents.length && !adminSnapshotQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Box sx={{ py: 5, textAlign: "center" }}>
                        <DescriptionOutlinedIcon color="disabled" sx={{ fontSize: 42, mb: 1 }} />
                        <Typography color="text.secondary">ยังไม่มีเอกสารเผยแพร่</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </MuiTable>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>{isCreating ? "เพิ่มเอกสารเผยแพร่" : "แก้ไขเอกสารเผยแพร่"}</DialogTitle>
        <DialogContent dividers>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}
          {editingDocument && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  label="ชื่อเอกสาร"
                  value={editingDocument.title}
                  onChange={(event) => updateEditingDocument("title", event.target.value)}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="document-status-label">สถานะ</InputLabel>
                  <Select
                    labelId="document-status-label"
                    label="สถานะ"
                    value={editingDocument.status}
                    onChange={(event) => updateEditingDocument("status", event.target.value as DocumentStatus)}
                  >
                    {documentStatusOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="คำอธิบาย"
                  value={editingDocument.description}
                  onChange={(event) => updateEditingDocument("description", event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="หมวดหมู่"
                  value={editingDocument.category}
                  onChange={(event) => updateEditingDocument("category", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  label="ลำดับ"
                  type="number"
                  value={editingDocument.order}
                  onChange={(event) => updateEditingDocument("order", Number(event.target.value))}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editingDocument.pinned}
                      onChange={(event) => updateEditingDocument("pinned", event.target.checked)}
                    />
                  }
                  label="ปักหมุด"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="ลิงก์ไฟล์"
                  value={editingDocument.fileUrl}
                  onChange={(event) => updateEditingDocument("fileUrl", event.target.value)}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="ชื่อไฟล์"
                  value={editingDocument.fileName}
                  onChange={(event) => updateEditingDocument("fileName", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Media ID"
                  value={editingDocument.mediaId}
                  onChange={(event) => updateEditingDocument("mediaId", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="วันที่เผยแพร่"
                  type="datetime-local"
                  value={toLocalDateTimeInputValue(editingDocument.publishedAt)}
                  onChange={(event) =>
                    updateEditingDocument("publishedAt", fromLocalDateTimeInputValue(event.target.value))
                  }
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 60 } }}
                  fullWidth
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>ยกเลิก</Button>
          <Button
            startIcon={<SaveOutlinedIcon />}
            variant="contained"
            onClick={() => void handleSaveDocument()}
            disabled={saveMutation.isPending}
          >
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
