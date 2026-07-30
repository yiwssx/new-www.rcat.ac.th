import { useEffect, useMemo, useState } from "react";
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
import Grid from "@mui/material/Grid";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ArrowDownwardOutlinedIcon from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowUpwardOutlinedIcon from "@mui/icons-material/ArrowUpwardOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import PageHeader from "../components/PageHeader";
import AdminPagination from "../components/AdminPagination";
import StatusChip from "../components/StatusChip";
import { useAuth } from "../../context/authSessionContext";
import { deleteDocumentFromApi, saveDocumentToApi, type DocumentItemInput } from "../../features/cms-documents";
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  adminDocumentOrderQueryOptions,
  adminListQueryKeys,
  getAdminDocumentList,
  getAdminPageAfterDelete,
  invalidateAdminListQueries,
  saveAdminDocumentOrder,
  useAdminDocumentListQuery,
  useAdminListUrlState,
  useDebouncedValue,
  type AdminDocumentOrderInput
} from "../../features/admin-pagination";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { CmsDocumentItem, DocumentStatus } from "../../types";
import { formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { appSwal, getSwalErrorText, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";
import { ADMIN_READ_ONLY_NOTICE, canManageDocuments } from "../utils/rbac";

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

const documentListUrlOptions = {
  defaultPageSize: 25,
  pageSizeOptions: ADMIN_PAGE_SIZE_OPTIONS,
  filterDefaults: { status: "all", pinned: "all" }
} as const;

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

function normalizeDocumentOrdersInCurrentOrder(items: CmsDocumentItem[]) {
  let pinnedOrder = 0;
  let unpinnedOrder = 0;

  return items.map((item) => {
    const order = item.pinned ? ++pinnedOrder : ++unpinnedOrder;

    return {
      ...item,
      order
    };
  });
}

function toOrderedDocumentDraft(items: CmsDocumentItem[]) {
  return normalizeDocumentOrdersInCurrentOrder(sortDocuments(items));
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

function areDocumentOrdersEqual(left: CmsDocumentItem[], right: CmsDocumentItem[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftItem, index) => {
    const rightItem = right[index];

    return (
      rightItem &&
      leftItem.id === rightItem.id &&
      leftItem.order === rightItem.order &&
      leftItem.pinned === rightItem.pinned
    );
  });
}

function moveDocumentWithinGroup(items: CmsDocumentItem[], document: CmsDocumentItem, direction: -1 | 1) {
  const groupItems = items.filter((item) => item.pinned === document.pinned);
  const groupIndex = groupItems.findIndex((item) => item.id === document.id);
  const nextGroupIndex = groupIndex + direction;

  if (groupIndex < 0 || nextGroupIndex < 0 || nextGroupIndex >= groupItems.length) {
    return items;
  }

  const nextGroupItems = [...groupItems];
  const [movedDocument] = nextGroupItems.splice(groupIndex, 1);

  if (!movedDocument) {
    return items;
  }

  nextGroupItems.splice(nextGroupIndex, 0, movedDocument);

  let nextGroupCursor = 0;
  const nextItems = items.map((item) => {
    if (item.pinned !== document.pinned) {
      return item;
    }

    const nextGroupItem = nextGroupItems[nextGroupCursor++];
    return nextGroupItem ?? item;
  });

  return normalizeDocumentOrdersInCurrentOrder(nextItems);
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
  const { capabilities } = useAuth();
  const canManage = canManageDocuments(capabilities);
  const {
    page,
    pageSize,
    q,
    filters,
    sortBy,
    sortDirection,
    setState: setListState,
    setPage,
    setPageSize,
    setSearch,
    setFilter
  } = useAdminListUrlState<"status" | "pinned">(documentListUrlOptions);
  const debouncedSearch = useDebouncedValue(q, 300);
  const adminListQuery = useAdminDocumentListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    status: filters.status as DocumentStatusFilter,
    pinned: filters.pinned as DocumentPinnedFilter,
    sortBy,
    sortDirection
  });

  useEffect(() => {
    const responsePage = adminListQuery.data?.pagination.page;

    if (!adminListQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState({ page: responsePage }, { replace: true });
    }
  }, [adminListQuery.data?.pagination.page, adminListQuery.isPlaceholderData, page, setListState]);
  const [orderingMode, setOrderingMode] = useState(false);
  const adminOrderQuery = useQuery({
    ...adminDocumentOrderQueryOptions(),
    enabled: orderingMode
  });
  const snapshotDocuments = useMemo(
    () =>
      toOrderedDocumentDraft(
        (adminOrderQuery.data ?? []).map((document) => ({
          ...document,
          description: "",
          category: "",
          fileUrl: "",
          fileName: "",
          mediaId: "",
          publishedAt: "",
          status: "draft" as const,
          updatedAt: ""
        }))
      ),
    [adminOrderQuery.data]
  );
  const [draftDocuments, setDraftDocuments] = useState<CmsDocumentItem[] | null>(null);
  const listDocuments = adminListQuery.data?.items ?? [];
  const documents = orderingMode ? (draftDocuments ?? snapshotDocuments) : listDocuments;
  const [editingDocument, setEditingDocument] = useState<CmsDocumentItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const listTransitioning = !orderingMode && (adminListQuery.isPlaceholderData || debouncedSearch !== q);
  const statusFilter = filters.status as DocumentStatusFilter;
  const pinnedFilter = filters.pinned as DocumentPinnedFilter;
  const documentOrderDirty = draftDocuments !== null && !areDocumentOrdersEqual(draftDocuments, snapshotDocuments);
  const filteredDocuments = documents;
  const pinnedDocuments = documents.filter((document) => document.pinned);
  const unpinnedDocuments = documents.filter((document) => !document.pinned);
  const filteredPinnedDocuments = filteredDocuments.filter((document) => document.pinned);
  const filteredUnpinnedDocuments = filteredDocuments.filter((document) => !document.pinned);

  const saveMutation = useMutation({
    mutationFn: saveDocumentToApi
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDocumentFromApi
  });
  const saveOrderMutation = useMutation({
    mutationFn: (orderedDocuments: AdminDocumentOrderInput[]) => saveAdminDocumentOrder(orderedDocuments)
  });
  const documentWritePending =
    saveMutation.isPending || deleteMutation.isPending || saveOrderMutation.isPending || listTransitioning;

  async function invalidateDocumentData() {
    await Promise.all([
      invalidatePublicCmsData(queryClient),
      invalidateAdminListQueries(queryClient, "documents"),
      queryClient.invalidateQueries({ queryKey: adminListQueryKeys.order("documents") })
    ]);
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

  async function getNextDocumentOrder(pinned: boolean) {
    const response = await getAdminDocumentList({
      page: 1,
      pageSize: 1,
      pinned,
      sortBy: "order",
      sortDirection: "desc"
    });
    return (response.items[0]?.order ?? 0) + 1;
  }

  async function handleAddDocument() {
    if (!canManage || documentWritePending) {
      return;
    }

    try {
      const nextOrder = await getNextDocumentOrder(false);
      setSaveError("");
      setEditingDocument(createDocumentDraft(nextOrder));
      setAdvancedOpen(false);
      setIsCreating(true);
      setDialogOpen(true);
    } catch (error) {
      await showErrorResult("ไม่สามารถเตรียมเอกสารใหม่ได้", error, "กรุณาลองอีกครั้ง");
    }
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
    const savedSnapshotDocument = documents.find((document) => document.id === editingDocument.id);

    if (!nextDocument.title || !nextDocument.fileUrl) {
      setSaveError("กรุณาระบุชื่อเอกสารและลิงก์ไฟล์");
      return;
    }

    try {
      if (!savedSnapshotDocument || savedSnapshotDocument.pinned !== nextDocument.pinned) {
        nextDocument.order = await getNextDocumentOrder(Boolean(nextDocument.pinned));
      }

      showBlockingLoading("กำลังบันทึกเอกสาร");
      await saveMutation.mutateAsync(nextDocument);
      await invalidateDocumentData();
      setDraftDocuments(null);
      if (isCreating) {
        setPage(1);
      }
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
      const currentPage = Number(new URLSearchParams(window.location.search).get("page")) || page;
      const nextPage =
        currentPage > 1 && listDocuments.length <= 1
          ? currentPage - 1
          : adminListQuery.data?.pagination
            ? getAdminPageAfterDelete(adminListQuery.data.pagination)
            : currentPage;
      await deleteMutation.mutateAsync(document.id);

      if (nextPage !== currentPage) {
        setPage(nextPage);
      }
      await invalidateDocumentData();
      await appSwal.close();
      await showSuccessResult("ลบเอกสารสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถลบเอกสารได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function handleMoveDocument(document: CmsDocumentItem, direction: -1 | 1) {
    if (!canManage || documentWritePending || !orderingMode) {
      return;
    }

    setDraftDocuments((current) => {
      const currentDocuments = current ?? snapshotDocuments;
      const nextDocuments = moveDocumentWithinGroup(currentDocuments, document, direction);

      return areDocumentOrdersEqual(nextDocuments, snapshotDocuments) ? null : nextDocuments;
    });
  }

  function handleResetDocumentOrder() {
    if (!canManage || documentWritePending) {
      return;
    }

    setDraftDocuments(null);
  }

  function handleOpenOrderingMode() {
    if (!canManage || documentWritePending) {
      return;
    }

    setDraftDocuments(null);
    setOrderingMode(true);
  }

  function handleCloseOrderingMode() {
    if (documentWritePending) {
      return;
    }

    setDraftDocuments(null);
    setOrderingMode(false);
  }

  async function handleSaveDocumentOrder() {
    if (!canManage || documentWritePending || !orderingMode || !draftDocuments || !documentOrderDirty) {
      return;
    }

    const orderedDocuments: AdminDocumentOrderInput[] = draftDocuments.map((document) => ({
      id: document.id,
      order: document.order,
      pinned: document.pinned,
      revision: document.revision ?? 0
    }));

    showBlockingLoading("กำลังบันทึกลำดับเอกสาร");

    try {
      await saveOrderMutation.mutateAsync(orderedDocuments);
      await invalidateDocumentData();
      setDraftDocuments(null);
      await appSwal.close();
      await showSuccessResult("บันทึกลำดับเอกสารสำเร็จ");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกลำดับเอกสารได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  return (
    <Box>
      <PageHeader
        title="เอกสารเผยแพร่"
        description="จัดการไฟล์เอกสารที่แสดงในหน้าแรกและรายการเอกสารสาธารณะ"
        action={
          canManage ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                disabled={documentWritePending}
                onClick={orderingMode ? handleCloseOrderingMode : handleOpenOrderingMode}
              >
                {orderingMode ? "กลับรายการเอกสาร" : "จัดลำดับ"}
              </Button>
              {!orderingMode && (
                <Button
                  startIcon={<AddOutlinedIcon />}
                  variant="contained"
                  disabled={documentWritePending}
                  onClick={() => void handleAddDocument()}
                >
                  เพิ่มเอกสาร
                </Button>
              )}
            </Stack>
          ) : undefined
        }
      />
      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}
      {(orderingMode ? adminOrderQuery.isLoading : adminListQuery.isLoading || listTransitioning) && (
        <LinearProgress sx={{ mb: 2 }} />
      )}
      {(orderingMode ? adminOrderQuery.isError : adminListQuery.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(orderingMode ? adminOrderQuery.error : adminListQuery.error) instanceof Error
            ? (orderingMode ? adminOrderQuery.error : adminListQuery.error)?.message
            : "ไม่สามารถโหลดรายการเอกสารได้"}
        </Alert>
      )}
      <Card className="rcat-card">
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            {!orderingMode && (
              <Grid
                container
                spacing={2}
                sx={{
                  alignItems: "center"
                }}
              >
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    placeholder="ค้นหาเอกสาร"
                    value={q}
                    onChange={(event) => setSearch(event.target.value)}
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
                      onChange={(event) => setFilter("status", event.target.value)}
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
                      onChange={(event) => setFilter("pinned", event.target.value)}
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
            )}
            {canManage && orderingMode && (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  alignItems: { xs: "stretch", sm: "center" },
                  mt: 2
                }}
              >
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<RestartAltOutlinedIcon />}
                  onClick={handleResetDocumentOrder}
                  disabled={!documentOrderDirty || documentWritePending}
                >
                  ยกเลิกการจัดลำดับ
                </Button>
                <Button variant="outlined" onClick={handleCloseOrderingMode} disabled={documentWritePending}>
                  ยกเลิกและกลับ
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  onClick={() => void handleSaveDocumentOrder()}
                  disabled={!documentOrderDirty || documentWritePending}
                >
                  {saveOrderMutation.isPending ? "กำลังบันทึก" : "บันทึกลำดับเอกสาร"}
                </Button>
              </Stack>
            )}
            {orderingMode && (
              <Alert severity="info" sx={{ mt: 2 }}>
                โหมดจัดลำดับโหลดเฉพาะข้อมูลขนาดเล็กของเอกสารทั้งหมด และแยกกลุ่มปักหมุดออกจากเอกสารทั่วไป
              </Alert>
            )}
          </Box>
          <Box
            className="table-scroll"
            aria-busy={!orderingMode && (adminListQuery.isFetching || listTransitioning)}
            sx={{ opacity: listTransitioning ? 0.55 : 1, transition: "opacity 120ms ease" }}
          >
            <MuiTable>
              <TableHead>
                <TableRow>
                  <TableCell>เอกสาร</TableCell>
                  <TableCell>หมวดหมู่</TableCell>
                  <TableCell>สถานะ</TableCell>
                  <TableCell>ลำดับในกลุ่ม</TableCell>
                  <TableCell>วันที่เผยแพร่</TableCell>
                  <TableCell align="right">จัดการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPinnedDocuments.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ bgcolor: "background.default" }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 900,
                          color: "text.secondary"
                        }}
                      >
                        เอกสารปักหมุด
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {filteredPinnedDocuments.map((document) => {
                  const groupIndex = pinnedDocuments.findIndex((item) => item.id === document.id);

                  return (
                    <TableRow key={document.id} hover>
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1.2}
                          sx={{
                            alignItems: "flex-start"
                          }}
                        >
                          <DescriptionOutlinedIcon color="primary" sx={{ mt: 0.4 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontWeight: 800
                              }}
                            >
                              {document.title || "ไม่มีชื่อเอกสาร"}
                            </Typography>
                            <Stack spacing={0.35} sx={{ mt: 0.35 }}>
                              {document.description && (
                                <Typography
                                  variant="body2"
                                  className="content-summary"
                                  sx={{
                                    color: "text.secondary",
                                    overflowWrap: "anywhere"
                                  }}
                                >
                                  {document.description}
                                </Typography>
                              )}
                              {document.fileName && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "text.secondary",
                                    overflowWrap: "anywhere"
                                  }}
                                >
                                  {document.fileName}
                                </Typography>
                              )}
                              {document.fileUrl && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "text.secondary",
                                    overflowWrap: "anywhere"
                                  }}
                                >
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
                        <Stack
                          spacing={0.6}
                          sx={{
                            alignItems: "flex-start"
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 700
                            }}
                          >
                            {document.order}
                          </Typography>
                          <Chip label="ปักหมุด" color="secondary" size="small" variant="outlined" />
                        </Stack>
                      </TableCell>
                      <TableCell>{document.publishedAt ? formatDisplayDateTime(document.publishedAt) : "-"}</TableCell>
                      <TableCell align="right">
                        {canManage && orderingMode && (
                          <>
                            <Tooltip title="เลื่อนขึ้น">
                              <span>
                                <IconButton
                                  aria-label={`เลื่อนขึ้น ${document.title || `ลำดับ ${document.order}`}`}
                                  disabled={documentWritePending || groupIndex === 0}
                                  onClick={() => handleMoveDocument(document, -1)}
                                >
                                  <ArrowUpwardOutlinedIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="เลื่อนลง">
                              <span>
                                <IconButton
                                  aria-label={`เลื่อนลง ${document.title || `ลำดับ ${document.order}`}`}
                                  disabled={documentWritePending || groupIndex === pinnedDocuments.length - 1}
                                  onClick={() => handleMoveDocument(document, 1)}
                                >
                                  <ArrowDownwardOutlinedIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </>
                        )}
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
                        {canManage && !orderingMode && (
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
                  );
                })}
                {filteredUnpinnedDocuments.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ bgcolor: "background.default" }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 900,
                          color: "text.secondary"
                        }}
                      >
                        เอกสารทั่วไป
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {filteredUnpinnedDocuments.map((document) => {
                  const groupIndex = unpinnedDocuments.findIndex((item) => item.id === document.id);

                  return (
                    <TableRow key={document.id} hover>
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1.2}
                          sx={{
                            alignItems: "flex-start"
                          }}
                        >
                          <DescriptionOutlinedIcon color="primary" sx={{ mt: 0.4 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontWeight: 800
                              }}
                            >
                              {document.title || "ไม่มีชื่อเอกสาร"}
                            </Typography>
                            <Stack spacing={0.35} sx={{ mt: 0.35 }}>
                              {document.description && (
                                <Typography
                                  variant="body2"
                                  className="content-summary"
                                  sx={{
                                    color: "text.secondary",
                                    overflowWrap: "anywhere"
                                  }}
                                >
                                  {document.description}
                                </Typography>
                              )}
                              {document.fileName && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "text.secondary",
                                    overflowWrap: "anywhere"
                                  }}
                                >
                                  {document.fileName}
                                </Typography>
                              )}
                              {document.fileUrl && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "text.secondary",
                                    overflowWrap: "anywhere"
                                  }}
                                >
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
                        <Typography
                          sx={{
                            fontWeight: 700
                          }}
                        >
                          {document.order}
                        </Typography>
                      </TableCell>
                      <TableCell>{document.publishedAt ? formatDisplayDateTime(document.publishedAt) : "-"}</TableCell>
                      <TableCell align="right">
                        {canManage && orderingMode && (
                          <>
                            <Tooltip title="เลื่อนขึ้น">
                              <span>
                                <IconButton
                                  aria-label={`เลื่อนขึ้น ${document.title || `ลำดับ ${document.order}`}`}
                                  disabled={documentWritePending || groupIndex === 0}
                                  onClick={() => handleMoveDocument(document, -1)}
                                >
                                  <ArrowUpwardOutlinedIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="เลื่อนลง">
                              <span>
                                <IconButton
                                  aria-label={`เลื่อนลง ${document.title || `ลำดับ ${document.order}`}`}
                                  disabled={documentWritePending || groupIndex === unpinnedDocuments.length - 1}
                                  onClick={() => handleMoveDocument(document, 1)}
                                >
                                  <ArrowDownwardOutlinedIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </>
                        )}
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
                        {canManage && !orderingMode && (
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
                  );
                })}
                {!filteredDocuments.length &&
                  !(orderingMode ? adminOrderQuery.isLoading : adminListQuery.isLoading) && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Box sx={{ py: 5, textAlign: "center" }}>
                          <DescriptionOutlinedIcon color="disabled" sx={{ fontSize: 42, mb: 1 }} />
                          <Typography
                            sx={{
                              color: "text.secondary"
                            }}
                          >
                            {documents.length ? "ไม่พบเอกสารที่ตรงกับเงื่อนไขการค้นหา" : "ยังไม่มีเอกสารเผยแพร่"}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </MuiTable>
          </Box>
          {!orderingMode && adminListQuery.data?.pagination && (
            <Box sx={{ px: 2 }}>
              <AdminPagination
                pagination={adminListQuery.data.pagination}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
                disabled={documentWritePending}
                isFetching={adminListQuery.isFetching}
              />
            </Box>
          )}
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
                <Stack
                  spacing={0.75}
                  sx={{
                    alignItems: "flex-start"
                  }}
                >
                  <Chip label={`ลำดับในกลุ่ม: ${editingDocument.order}`} size="small" variant="outlined" />
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    ปรับลำดับจากรายการเอกสารด้านนอกด้วยปุ่มเลื่อนขึ้น/เลื่อนลง
                  </Typography>
                </Stack>
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
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    เมื่อเปลี่ยนการปักหมุด รายการจะถูกจัดอยู่ในกลุ่มเอกสารปักหมุดหรือเอกสารทั่วไป
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
