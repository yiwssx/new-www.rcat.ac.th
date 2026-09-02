import { useCallback, useEffect, useMemo, useState } from "react";
import { createColumnHelper, flexRender, stockFeatures, useTable, type StockFeatures } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ContentEditorDialog from "../components/ContentEditorDialog";
import ContentWorkflowGuide from "../components/ContentWorkflowGuide";
import AdminPagination from "../components/AdminPagination";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import { useAuth } from "../../context/authSessionContext";
import {
  deleteContentItem,
  getAdminContentDetail,
  isAdminStaleRevisionError,
  publishContent,
  saveContentItem,
  type ContentSaveProgress
} from "../../features/cms-content";
import { saveMediaAsset, type MediaAssetInput, type MediaUploadOptions } from "../../features/cms-media";
import { ContentItem, ContentStatus } from "../../types";
import {
  clearContentDraftRecovery,
  readContentDraftRecovery,
  type ContentDraftRecovery,
  type ContentDraftRecoveryMode
} from "../../features/cms-content/draftRecovery";
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  adminListQueryKeys,
  getAdminPageAfterDelete,
  invalidateAdminListQueries,
  type AdminContentListItem,
  useAdminContentListQuery,
  useAdminListUrlState,
  useDebouncedValue
} from "../../features/admin-pagination";
import { formatDisplayDate } from "../../utils/dateDisplay";
import {
  appSwal,
  getSwalErrorText,
  showBlockingLoading,
  showErrorResult,
  showSuccessResult,
  updateBlockingLoading
} from "../../utils/swal";
import { invalidateDeletedPublicContent, invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { FACEBOOK_EMBED_LABEL, isFacebookEmbedContent } from "../../utils/facebookContent";
import { contentStatusLabels, contentTypeLabels } from "../../utils/thaiLabels";
import { ADMIN_READ_ONLY_NOTICE, canManageContent } from "../utils/rbac";
import ActionBar from "../../design-system/components/ActionBar";

type FilterStatus = ContentStatus | "all";
type ContentFilterKey = "status";
type ContentSaveMutationInput = {
  item: ContentItem;
  onProgress?: (progress: ContentSaveProgress) => void;
};

const columnHelper = createColumnHelper<StockFeatures, AdminContentListItem>();
const contentListUrlOptions = {
  defaultPageSize: 25,
  pageSizeOptions: ADMIN_PAGE_SIZE_OPTIONS,
  defaultSortBy: "updatedAt",
  defaultSortDirection: "desc" as const,
  filterDefaults: { status: "all" }
};
const emptyContentItems: AdminContentListItem[] = [];
const contentTableColumnLayout = {
  title: { minWidth: 460, whiteSpace: "normal" },
  type: { minWidth: 88, whiteSpace: "nowrap" },
  status: { minWidth: 120, whiteSpace: "nowrap" },
  owner: { minWidth: 120, whiteSpace: "nowrap" },
  updatedAt: { minWidth: 132, whiteSpace: "nowrap" },
  actions: { minWidth: 184, whiteSpace: "nowrap" }
} as const;
const contentTableMinWidth = Object.values(contentTableColumnLayout).reduce(
  (total, column) => total + column.minWidth,
  0
);

function getContentTableColumnSx(columnId: string) {
  return contentTableColumnLayout[columnId as keyof typeof contentTableColumnLayout];
}

function waitForDialogTransition() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 220);
  });
}

export default function ContentPage() {
  const queryClient = useQueryClient();
  const { capabilities, hasCapability, session } = useAuth();
  const ownerUserId = session?.user.id ?? "";
  const canManage = canManageContent(capabilities);
  const canCreate = hasCapability("content.create");
  const canUpdate = hasCapability("content.update");
  const canDelete = hasCapability("content.delete");
  const canPublish = hasCapability("content.publish");
  const canManageMedia = hasCapability("media.manage");
  const {
    page,
    pageSize,
    q,
    sortBy,
    sortDirection,
    filters,
    setState: setListState,
    setPage,
    setPageSize,
    setSearch,
    setFilter
  } = useAdminListUrlState<ContentFilterKey>(contentListUrlOptions);
  const debouncedSearch = useDebouncedValue(q, 300);
  const status = (filters.status || "all") as FilterStatus;
  const contentListQuery = useAdminContentListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    status,
    sortBy,
    sortDirection
  });
  const listTransitioning = contentListQuery.isPlaceholderData || debouncedSearch !== q;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<ContentDraftRecoveryMode>("create");
  const [restoredRecovery, setRestoredRecovery] = useState(false);
  const [draftRecovery, setDraftRecovery] = useState<ContentDraftRecovery | null>(() =>
    readContentDraftRecovery(ownerUserId)
  );
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [saveError, setSaveError] = useState("");
  const [loadingEditorItem, setLoadingEditorItem] = useState(false);
  const items = contentListQuery.data?.items ?? emptyContentItems;

  useEffect(() => {
    const responsePage = contentListQuery.data?.pagination.page;

    if (!contentListQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState({ page: responsePage }, { replace: true });
    }
  }, [contentListQuery.data?.pagination.page, contentListQuery.isPlaceholderData, page, setListState]);

  useEffect(() => {
    // This effect intentionally rehydrates owner-scoped recovery state when the authenticated owner changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftRecovery(readContentDraftRecovery(ownerUserId));
  }, [ownerUserId]);

  const saveMutation = useMutation({
    mutationFn: ({ item, onProgress }: ContentSaveMutationInput) => saveContentItem(item, { onProgress })
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContentItem
  });

  const publishMutation = useMutation({
    mutationFn: publishContent
  });

  const mediaMutation = useMutation({
    mutationFn: ({ input, options }: { input: MediaAssetInput; options?: MediaUploadOptions }) =>
      saveMediaAsset(input, options),
    onSuccess: async () => {
      await invalidateAdminListQueries(queryClient, "media");
    }
  });
  const contentWritePending =
    saveMutation.isPending || deleteMutation.isPending || publishMutation.isPending || listTransitioning;

  const handleEdit = useCallback(
    async (item: AdminContentListItem) => {
      if (!canUpdate || contentWritePending || draftRecovery) {
        return;
      }

      setSaveError("");
      setLoadingEditorItem(true);

      try {
        const detail = await getAdminContentDetail({ id: item.id });
        setEditorMode("edit");
        setRestoredRecovery(false);
        setSelectedItem(detail);
        setEditorOpen(true);
      } catch (error) {
        await appSwal.fire({
          icon: "error",
          title: "ไม่สามารถเปิดตัวแก้ไขได้",
          text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
          confirmButtonText: "ตกลง"
        });
      } finally {
        setLoadingEditorItem(false);
      }
    },
    [canUpdate, contentWritePending, draftRecovery]
  );

  const handleDelete = useCallback(
    async (item: AdminContentListItem) => {
      if (!canDelete || contentWritePending) {
        return;
      }

      const result = await appSwal.fire({
        title: "ลบเนื้อหา?",
        text: item.title,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ลบ",
        cancelButtonText: "ยกเลิก"
      });

      if (!result.isConfirmed) {
        return;
      }

      showBlockingLoading("กำลังลบเนื้อหา");

      try {
        await deleteMutation.mutateAsync(item);
        const pagination = contentListQuery.data?.pagination;

        if (pagination) {
          const nextPage = getAdminPageAfterDelete(pagination);
          if (nextPage !== page) {
            setListState({ page: nextPage }, { replace: true });
          }
        }

        await Promise.all([
          invalidateAdminListQueries(queryClient, "content"),
          invalidateDeletedPublicContent(queryClient, item.slug)
        ]);
        await appSwal.close();
        await showSuccessResult("ลบเนื้อหาสำเร็จ");
      } catch (currentError) {
        await appSwal.close();
        await showErrorResult("ไม่สามารถลบเนื้อหาได้", currentError, "กรุณาลองอีกครั้ง");
      }
    },
    [canDelete, contentListQuery.data, contentWritePending, deleteMutation, page, setListState, queryClient]
  );

  const handlePublish = useCallback(
    async (item: AdminContentListItem) => {
      if (!canPublish || contentWritePending) {
        return;
      }

      const result = await appSwal.fire({
        title: "เผยแพร่เนื้อหา?",
        text: item.title,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "เผยแพร่",
        cancelButtonText: "ยกเลิก"
      });

      if (!result.isConfirmed) {
        return;
      }

      showBlockingLoading("กำลังเผยแพร่เนื้อหา");

      try {
        await publishMutation.mutateAsync(item);
        await Promise.all([invalidateAdminListQueries(queryClient, "content"), invalidatePublicCmsData(queryClient)]);
        await appSwal.close();
        await showSuccessResult("เผยแพร่เนื้อหาสำเร็จ");
      } catch (currentError) {
        if (isAdminStaleRevisionError(currentError)) {
          await queryClient.invalidateQueries({ queryKey: adminListQueryKeys.entity("content") });
        }

        await appSwal.close();
        await showErrorResult("ไม่สามารถเผยแพร่เนื้อหาได้", currentError, "กรุณาลองอีกครั้ง");
      }
    },
    [canPublish, contentWritePending, publishMutation, queryClient]
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("title", {
          header: "ชื่อเรื่อง",
          cell: (info) => (
            <Box>
              <Typography
                sx={{
                  fontWeight: 800
                }}
              >
                {info.getValue()}
              </Typography>
              <Typography
                variant="body2"
                className="content-summary"
                sx={{
                  color: "text.secondary"
                }}
              >
                {info.row.original.summary}
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                useFlexGap
                sx={{
                  alignItems: "center",
                  flexWrap: "wrap",
                  mt: 0.5
                }}
              >
                {!!info.row.original.category && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    {info.row.original.category}
                  </Typography>
                )}
                {isFacebookEmbedContent(info.row.original) && (
                  <Chip label={FACEBOOK_EMBED_LABEL} size="small" color="primary" variant="outlined" />
                )}
              </Stack>
            </Box>
          )
        }),
        columnHelper.accessor("type", {
          header: "ประเภท",
          cell: (info) => <Typography>{contentTypeLabels[info.getValue()]}</Typography>
        }),
        columnHelper.accessor("status", {
          header: "สถานะ",
          cell: (info) => <StatusChip status={info.getValue()} />
        }),
        columnHelper.accessor("owner", {
          header: "ผู้รับผิดชอบ"
        }),
        columnHelper.accessor("updatedAt", {
          header: "ปรับปรุง",
          cell: (info) => formatDisplayDate(info.getValue())
        }),
        columnHelper.display({
          id: "actions",
          header: "",
          cell: (info) => (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                justifyContent: "flex-end",
                flexWrap: "nowrap"
              }}
            >
              <Tooltip title="ดูหน้าสาธารณะ">
                <span>
                  <IconButton
                    aria-label="ดูหน้าสาธารณะ"
                    component="a"
                    href={`/content/${info.row.original.slug}`}
                    size="small"
                    disabled={info.row.original.status !== "published" && info.row.original.status !== "scheduled"}
                  >
                    <OpenInNewOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              {(canUpdate || canPublish || canDelete) && (
                <>
                  <Tooltip title="แก้ไข">
                    <span>
                      <IconButton
                        aria-label="แก้ไข"
                        size="small"
                        disabled={!canUpdate || loadingEditorItem || contentWritePending || Boolean(draftRecovery)}
                        onClick={() => void handleEdit(info.row.original)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {canPublish && info.row.original.status !== "published" && (
                    <Tooltip title="เผยแพร่">
                      <span>
                        <IconButton
                          aria-label="เผยแพร่"
                          size="small"
                          color="primary"
                          disabled={contentWritePending}
                          onClick={() => void handlePublish(info.row.original)}
                        >
                          <PublishOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  <Tooltip title="ลบ">
                    <span>
                      <IconButton
                        aria-label="ลบ"
                        size="small"
                        color="error"
                        disabled={!canDelete || contentWritePending}
                        onClick={() => void handleDelete(info.row.original)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}
            </Stack>
          )
        })
      ]),
    [
      canDelete,
      canPublish,
      canUpdate,
      contentWritePending,
      draftRecovery,
      handleDelete,
      handleEdit,
      handlePublish,
      loadingEditorItem
    ]
  );
  const table = useTable({
    features: stockFeatures,
    data: items,
    columns
  });

  function handleCreate() {
    if (!canCreate || contentWritePending || draftRecovery) {
      return;
    }

    setSaveError("");
    setEditorMode("create");
    setRestoredRecovery(false);
    setSelectedItem(null);
    setEditorOpen(true);
  }

  async function handleSave(item: ContentItem) {
    const allowed = item.id ? canUpdate : canCreate;

    if (!allowed) {
      setSaveError(ADMIN_READ_ONLY_NOTICE);
      return;
    }

    if (contentWritePending) {
      return;
    }

    showBlockingLoading("กำลังบันทึกเนื้อหา", "10% • กำลังตรวจสอบข้อมูลก่อนบันทึก");

    try {
      setSaveError("");
      const isCreating = !item.id;
      await saveMutation.mutateAsync({
        item,
        onProgress: (progress) => {
          updateBlockingLoading("กำลังบันทึกเนื้อหา", `${progress.percent}% • ${progress.message}`);
        }
      });
      if (isCreating) {
        setListState({ page: 1 }, { replace: true });
      }
      updateBlockingLoading("กำลังบันทึกเนื้อหา", "90% • กำลังอัปเดตรายการและหน้าเว็บ");
      await Promise.all([invalidateAdminListQueries(queryClient, "content"), invalidatePublicCmsData(queryClient)]);
      updateBlockingLoading("กำลังบันทึกเนื้อหา", "100% • บันทึกและอัปเดตข้อมูลเรียบร้อย");
      clearContentDraftRecovery();
      setDraftRecovery(null);
      setRestoredRecovery(false);
      await appSwal.close();
      setEditorOpen(false);
      setSelectedItem(null);
      await waitForDialogTransition();
      await showSuccessResult("บันทึกเนื้อหาสำเร็จ");
    } catch (currentError) {
      if (isAdminStaleRevisionError(currentError)) {
        await invalidateAdminListQueries(queryClient, "content");
      }
      await appSwal.close();
      setSaveError(getSwalErrorText(currentError, "กรุณาตรวจสอบรายละเอียดเนื้อหา"));
      await showErrorResult("ไม่สามารถบันทึกเนื้อหาได้", currentError, "กรุณาตรวจสอบรายละเอียดเนื้อหา");
    }
  }

  async function handleUploadMedia(input: MediaAssetInput, options?: MediaUploadOptions) {
    if (!canManageMedia) {
      throw new Error(ADMIN_READ_ONLY_NOTICE);
    }

    return mediaMutation.mutateAsync({ input, options });
  }

  function handleRestoreDraft() {
    if (!draftRecovery) {
      return;
    }

    setSaveError("");
    setEditorMode(draftRecovery.mode);
    setRestoredRecovery(true);
    setSelectedItem(draftRecovery.item);
    setEditorOpen(true);
  }

  function handleDiscardRecoveredDraft() {
    clearContentDraftRecovery();
    setDraftRecovery(null);
    setRestoredRecovery(false);
  }

  return (
    <Box>
      <PageHeader
        title="เนื้อหา"
        description="สร้างและดูแลหน้าเว็บ บทความ ข้อมูลแผนกวิชา ข่าว และประกาศ"
        action={
          canCreate ? (
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              disabled={contentWritePending || Boolean(draftRecovery)}
              onClick={handleCreate}
            >
              เพิ่มเนื้อหา
            </Button>
          ) : undefined
        }
      />
      <ContentWorkflowGuide />
      {draftRecovery && !editorOpen && (
        <Alert
          severity="warning"
          action={
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button color="inherit" size="small" onClick={handleRestoreDraft}>
                กู้คืนฉบับร่าง
              </Button>
              <Button color="inherit" size="small" onClick={handleDiscardRecoveredDraft}>
                ละทิ้ง
              </Button>
            </Stack>
          }
          sx={{ mb: 2 }}
        >
          พบฉบับร่างเนื้อหาที่ยังไม่บันทึกจากก่อนเข้าสู่ระบบหรือโหลดหน้าใหม่
        </Alert>
      )}
      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}
      {contentListQuery.isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {contentListQuery.error instanceof Error ? contentListQuery.error.message : "ไม่สามารถโหลดเนื้อหาได้ในขณะนี้"}
        </Alert>
      )}
      {contentListQuery.isLoading && <LinearProgress sx={{ mb: 3 }} />}
      {(contentListQuery.isFetching || listTransitioning) && !contentListQuery.isLoading && (
        <LinearProgress sx={{ mb: 1 }} />
      )}
      <Card>
        <CardContent>
          <ActionBar
            primary={
              <TextField
                placeholder="ค้นหาเนื้อหา"
                value={q}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlinedIcon />
                      </InputAdornment>
                    )
                  }
                }}
                sx={{ minWidth: { lg: 360 } }}
              />
            }
            secondary={
              <ToggleButtonGroup
                value={status}
                exclusive
                onChange={(_, value: FilterStatus | null) => value && setFilter("status", value)}
                size="small"
                aria-label="ตัวกรองสถานะ"
              >
                {(["all", "draft", "review", "scheduled", "published"] as FilterStatus[]).map((item) => (
                  <ToggleButton key={item} value={item} sx={{ textTransform: "capitalize" }}>
                    {item === "all" ? "ทั้งหมด" : contentStatusLabels[item]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            }
          />
          <Box
            className="table-scroll"
            aria-busy={contentListQuery.isFetching}
            sx={{ opacity: listTransitioning ? 0.55 : 1, transition: "opacity 120ms ease" }}
          >
            <MuiTable aria-label="ตารางเนื้อหา" sx={{ minWidth: contentTableMinWidth }}>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableCell
                        key={header.id}
                        data-column-id={header.column.id}
                        sx={{ fontWeight: 800, ...getContentTableColumnSx(header.column.id) }}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        data-column-id={cell.column.id}
                        sx={getContentTableColumnSx(cell.column.id)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {!table.getRowModel().rows.length && (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Stack spacing={0.5}>
                        <Typography sx={{ color: "text.secondary" }}>ยังไม่มีรายการเนื้อหาตามตัวกรองนี้</Typography>
                        {canCreate && (
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            กด “เพิ่มเนื้อหา” เพื่อเริ่มเขียนฉบับร่างแรก หรือปรับตัวกรองสถานะด้านบน
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </MuiTable>
          </Box>
          {contentListQuery.data && (
            <AdminPagination
              pagination={{
                ...contentListQuery.data.pagination,
                page,
                pageSize
              }}
              pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              disabled={contentWritePending}
              isFetching={contentListQuery.isFetching}
            />
          )}
        </CardContent>
      </Card>
      <ContentEditorDialog
        open={editorOpen}
        item={selectedItem}
        mode={editorMode}
        ownerUserId={ownerUserId}
        recovered={restoredRecovery}
        recoveredTagInputValue={restoredRecovery ? (draftRecovery?.tagInputValue ?? "") : ""}
        saving={saveMutation.isPending}
        errorMessage={saveError}
        onClose={() => {
          clearContentDraftRecovery();
          setDraftRecovery(null);
          setRestoredRecovery(false);
          setSaveError("");
          setEditorOpen(false);
        }}
        onSave={(item) => {
          void handleSave(item);
        }}
        onUploadMedia={handleUploadMedia}
      />
    </Box>
  );
}
