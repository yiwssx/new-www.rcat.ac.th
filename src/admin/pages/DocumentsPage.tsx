import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import { useAuth } from "../../context/authSessionContext";
import { getAdminCmsSnapshot } from "../../features/cms-dashboard";
import { deleteDocumentFromApi, saveDocumentToApi, type DocumentItemInput } from "../../features/cms-documents";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { CmsDocumentItem, DocumentStatus } from "../../types";
import { formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { appSwal, getSwalErrorText, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";
import { ADMIN_READ_ONLY_NOTICE, canManageContent } from "../utils/rbac";

const documentStatusOptions: Array<{ value: DocumentStatus; label: string }> = [
  { value: "draft", label: "ฉบับร่าง" },
  { value: "published", label: "เผยแพร่" }
];

type DocumentStatusFilter = "all" | DocumentStatus;
type DocumentPinnedFilter = "all" | "pinned" | "unpinned";

const statusFilterOptions: Array<{ value: DocumentStatusFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  ...documentStatusOptions
];

const pinnedFilterOptions: Array<{ value: DocumentPinnedFilter; label: string }> = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pinned", label: "ปักหมุด" },
  { value: "unpinned", label: "ไม่ปักหมุด" }
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

function documentMatchesSearch(document: CmsDocumentItem, query: string) {
  if (!query) {
    return true;
  }

  return [document.title, document.description, document.fileName, document.fileUrl, document.category].some((value) =>
    value.toLocaleLowerCase().includes(query)
  );
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
  const { session } = useAuth();
  const canManage = canManageContent(session?.user);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter>("all");
  const [pinnedFilter, setPinnedFilter] = useState<DocumentPinnedFilter>("all");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const matchesSearch = documentMatchesSearch(document, normalizedSearchQuery);
        const matchesStatus = statusFilter === "all" || document.status === statusFilter;
        const matchesPinned =
          pinnedFilter === "all" ||
          (pinnedFilter === "pinned" && document.pinned) ||
          (pinnedFilter === "unpinned" && !document.pinned);

        return matchesSearch && matchesStatus && matchesPinned;
      }),
    [documents, normalizedSearchQuery, pinnedFilter, statusFilter]
  );

  const saveMutation = useMutation({
    mutationFn: saveDocumentToApi
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDocumentFromApi
  });
  const documentWritePending = saveMutation.isPending || deleteMutation.isPending;

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
    if (!canManage || documentWritePending) {
      return;
    }

    setSaveError("");
    setEditingDocument(createDocumentDraft(documents.length + 1));
    setAdvancedOpen(false);
    setIsCreating(true);
    setDialogOpen(true);
  }

  function handleEditDocument(document: CmsDocumentItem) {
    if (!canManage || documentWritePending) {
      return;
    }

    setSaveError("");
    setEditingDocument({
      ...document,
      publishedAt: document.publishedAt || ""
    });
    setAdvancedOpen(false);
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
    setAdvancedOpen(false);
  }

  async function handleSaveDocument() {
    if (!canManage) {
      setSaveError(ADMIN_READ_ONLY_NOTICE);
      return;
    }

    if (documentWritePending) {
      return;
    }

    if (!editingDocument) {
      return;
    }

    const nextDocument = normalizeDocumentDraft(editingDocument);

    if (!nextDocument.title || !nextDocument.fileUrl) {
      setSaveError("กรุณาระบุชื่อเอกสารและลิงก์ไฟล์");
      return;
    }

    showBlockingLoading("กำลังบันทึกเอกสาร");

    try {
      await saveMutation.mutateAsync(nextDocument);
      await invalidateDocumentData();
      await appSwal.close();
      handleCloseDialog();
      await showSuccessResult("บันทึกเอกสารสำเร็จ");
    } catch (error) {
      await appSwal.close();
      setSaveError(getSwalErrorText(error, "ไม่สามารถบันทึกเอกสารได้"));
      await showErrorResult("ไม่สามารถบันทึกเอกสารได้", error, "กรุณาตรวจสอบรายละเอียดเอกสาร");
    }
  }

  async function handleDeleteDocument(document: CmsDocumentItem) {
    if (!canManage || documentWritePending) {
      return;
    }

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

    showBlockingLoading("กำลังลบเอกสาร");

    try {
      await deleteMutation.mutateAsync(document.id);
      await invalidateDocumentData();
      await appSwal.close();
      await showSuccessResult("ลบเอกสารสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถลบเอกสารได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  return (
    <Box>
      <PageHeader
        title="เอกสารเผยแพร่"
        description="จัดการไฟล์เอกสารที่แสดงในหน้าแรกและรายการเอกสารสาธารณะ"
        action={
          canManage ? (
            <Button
              startIcon={<AddOutlinedIcon />}
              variant="contained"
              disabled={documentWritePending}
              onClick={handleAddDocument}
            >
              เพิ่มเอกสาร
            </Button>
          ) : undefined
        }
      />

      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}

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
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  placeholder="ค้นหาเอกสาร"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "ค้นหาเอกสาร"
                    }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="document-status-filter-label">สถานะ</InputLabel>
                  <Select
                    labelId="document-status-filter-label"
                    label="สถานะ"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as DocumentStatusFilter)}
                  >
                    {statusFilterOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="document-pinned-filter-label">การปักหมุด</InputLabel>
                  <Select
                    labelId="document-pinned-filter-label"
                    label="การปักหมุด"
                    value={pinnedFilter}
                    onChange={(event) => setPinnedFilter(event.target.value as DocumentPinnedFilter)}
                  >
                    {pinnedFilterOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
          <Box className="table-scroll">
            <MuiTable>
              <TableHead>
                <TableRow>
                  <TableCell>เอกสาร</TableCell>
                  <TableCell>หมวดหมู่</TableCell>
                  <TableCell>สถานะ</TableCell>
                  <TableCell>ลำดับ / ปักหมุด</TableCell>
                  <TableCell>วันที่เผยแพร่</TableCell>
                  <TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDocuments.map((document) => (
                  <TableRow key={document.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.2} alignItems="flex-start">
                        <DescriptionOutlinedIcon color="primary" sx={{ mt: 0.4 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={800}>{document.title || "ไม่มีชื่อเอกสาร"}</Typography>
                          <Stack spacing={0.35} sx={{ mt: 0.35 }}>
                            {document.description && (
                              <Typography
                                color="text.secondary"
                                variant="body2"
                                className="content-summary"
                                sx={{ overflowWrap: "anywhere" }}
                              >
                                {document.description}
                              </Typography>
                            )}
                            {document.fileName && (
                              <Typography color="text.secondary" variant="caption" sx={{ overflowWrap: "anywhere" }}>
                                {document.fileName}
                              </Typography>
                            )}
                            {document.fileUrl && (
                              <Typography color="text.secondary" variant="caption" sx={{ overflowWrap: "anywhere" }}>
                                {document.fileUrl}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ overflowWrap: "anywhere" }}>{document.category || "-"}</TableCell>
                    <TableCell>
                      <StatusChip status={document.status} />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.6} alignItems="flex-start">
                        <Typography fontWeight={700}>{document.order}</Typography>
                        {document.pinned && <Chip label="ปักหมุด" color="secondary" size="small" variant="outlined" />}
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
                      {canManage && (
                        <>
                          <Tooltip title="แก้ไข">
                            <span>
                              <IconButton
                                aria-label="แก้ไข"
                                disabled={documentWritePending}
                                onClick={() => handleEditDocument(document)}
                              >
                                <EditOutlinedIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="ลบ">
                            <span>
                              <IconButton
                                aria-label="ลบ"
                                color="error"
                                disabled={documentWritePending}
                                onClick={() => void handleDeleteDocument(document)}
                              >
                                <DeleteOutlineOutlinedIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredDocuments.length && !adminSnapshotQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Box sx={{ py: 5, textAlign: "center" }}>
                        <DescriptionOutlinedIcon color="disabled" sx={{ fontSize: 42, mb: 1 }} />
                        <Typography color="text.secondary">
                          {documents.length ? "ไม่พบเอกสารที่ตรงกับเงื่อนไขการค้นหา" : "ยังไม่มีเอกสารเผยแพร่"}
                        </Typography>
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
                  helperText="ใช้จัดลำดับภายในกลุ่มเอกสาร เอกสารที่ปักหมุดจะแสดงก่อนเสมอ"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Stack spacing={0.5}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editingDocument.pinned}
                        onChange={(event) => updateEditingDocument("pinned", event.target.checked)}
                      />
                    }
                    label="ปักหมุด"
                  />
                  <Typography color="text.secondary" variant="caption">
                    เอกสารที่ปักหมุดจะแสดงก่อนเอกสารทั่วไป
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="ลิงก์ไฟล์"
                  value={editingDocument.fileUrl}
                  onChange={(event) => updateEditingDocument("fileUrl", event.target.value)}
                  required
                  helperText="กรอก URL ของไฟล์ที่เปิดอ่านหรือดาวน์โหลดได้ เช่น Google Drive หรือไฟล์สาธารณะ"
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
              <Grid size={{ xs: 12 }}>
                <Stack spacing={1.25} sx={{ pt: 1, borderTop: 1, borderColor: "divider" }}>
                  <Button
                    type="button"
                    variant="text"
                    endIcon={advancedOpen ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
                    aria-expanded={advancedOpen}
                    onClick={() => setAdvancedOpen((current) => !current)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    ข้อมูลขั้นสูง
                  </Button>
                  {advancedOpen && (
                    <TextField
                      label="Media ID"
                      value={editingDocument.mediaId}
                      onChange={(event) => updateEditingDocument("mediaId", event.target.value)}
                      helperText="ใช้เมื่อเชื่อมโยงกับไฟล์ในคลังสื่อ ระบบทั่วไปไม่จำเป็นต้องกรอกเอง"
                      fullWidth
                    />
                  )}
                </Stack>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saveMutation.isPending}>
            ยกเลิก
          </Button>
          <Button
            startIcon={<SaveOutlinedIcon />}
            variant="contained"
            onClick={() => void handleSaveDocument()}
            disabled={!canManage || saveMutation.isPending}
          >
            {saveMutation.isPending ? "กำลังบันทึก" : "บันทึก"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
