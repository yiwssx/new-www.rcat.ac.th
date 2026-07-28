import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ContentEditorDialog from "../components/ContentEditorDialog";
import AdminPagination from "../components/AdminPagination";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import { useAuth } from "../../context/authSessionContext";
import {
  deleteContentItem,
  getAdminContentDetail,
  isAdminStaleRevisionError,
  publishContent,
  saveContentItem
} from "../../features/cms-content";
import { saveMediaAsset, type MediaAssetInput } from "../../features/cms-media";
import { ContentItem, ContentStatus } from "../../types";
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
import { appSwal, getSwalErrorText, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { invalidateDeletedPublicContent, invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { FACEBOOK_EMBED_LABEL, isFacebookEmbedContent } from "../../utils/facebookContent";
import { contentStatusLabels, contentTypeLabels } from "../../utils/thaiLabels";
import { ADMIN_READ_ONLY_NOTICE, canManageContent } from "../utils/rbac";
import ActionBar from "../../design-system/components/ActionBar";

type FilterStatus = ContentStatus | "all";
type ContentFilterKey = "status";

const columnHelper = createColumnHelper<AdminContentListItem>();
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
  const { capabilities, hasCapability } = useAuth();
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

  const saveMutation = useMutation({
    mutationFn: saveContentItem
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContentItem
  });

  const publishMutation = useMutation({
    mutationFn: publishContent
  });

  const mediaMutation = useMutation({
    mutationFn: saveMediaAsset,
    onSuccess: async () => {
      await invalidateAdminListQueries(queryClient, "media");
    }
  });
  const contentWritePending =
    saveMutation.isPending || deleteMutation.isPending || publishMutation.isPending || listTransitioning;

  const handleEdit = useCallback(
    async (item: AdminContentListItem) => {
      if (!canUpdate || contentWritePending) {
        return;
      }

      setSaveError("");
      setLoadingEditorItem(true);

      try {
        const detail = await getAdminContentDetail({ id: item.id });
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
    [canUpdate, contentWritePending]
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
    [canDelete, contentListQuery.data?.pagination, contentWritePending, deleteMutation, page, setListState, queryClient]
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
    () => [
      columnHelper.accessor("title", {
        header: "ชื่อเรื่อง",
        cell: (info) => (
          <Box>
            <Typography fontWeight={800}>{info.getValue()}</Typography>
            <Typography color="text.secondary" variant="body2" className="content-summary">
              {info.row.original.summary}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {!!info.row.original.category && (
                <Typography color="text.secondary" variant="caption">
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
          <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="nowrap">
            <Tooltip title="ดูหน้าสาธารณะ">
              <span>
                <IconButton
                  aria-label="ดูหน้าสาธารณะ"
                  component="a"
                  href={`/content/${info.row.original.slug}`}
                  size="small"
                  disabled={info.row.original.status !== "published" && info.row.original.status !== "scheduled"}
                >
                  <OpenInNewRoundedIcon fontSize="small" />
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
                      disabled={!canUpdate || loadingEditorItem || contentWritePending}
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
    ],
    [canDelete, canPublish, canUpdate, contentWritePending, handleDelete, handleEdit, handlePublish, loadingEditorItem]
  );

  // TanStack Table intentionally returns instance functions that React Compiler cannot memoize safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  function handleCreate() {
    if (!canCreate || contentWritePending) {
      return;
    }

    setSaveError("");
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

    showBlockingLoading("กำลังบันทึกเนื้อหา");

    try {
      setSaveError("");
      const isCreating = !item.id;
      await saveMutation.mutateAsync(item);
      if (isCreating) {
        setListState({ page: 1 }, { replace: true });
      }
      await Promise.all([invalidateAdminListQueries(queryClient, "content"), invalidatePublicCmsData(queryClient)]);
      await appSwal.close();
      setEditorOpen(false);
      setSelectedItem(null);
      await waitForDialogTransition();
      await showSuccessResult("บันทึกเนื้อหาสำเร็จ");
    } catch (currentError) {
      if (isAdminStaleRevisionError(currentError)) {
        if (currentError.latestItem) {
          setSelectedItem(currentError.latestItem);
        }
        await invalidateAdminListQueries(queryClient, "content");
      }
      await appSwal.close();
      setSaveError(getSwalErrorText(currentError, "กรุณาตรวจสอบรายละเอียดเนื้อหา"));
      await showErrorResult("ไม่สามารถบันทึกเนื้อหาได้", currentError, "กรุณาตรวจสอบรายละเอียดเนื้อหา");
    }
  }

  async function handleUploadMedia(input: MediaAssetInput) {
    if (!canManageMedia) {
      throw new Error(ADMIN_READ_ONLY_NOTICE);
    }

    return mediaMutation.mutateAsync(input);
  }

  return (
    <Box>
      <PageHeader
        title="เนื้อหา"
        description="สร้างและดูแลหน้าเว็บ บทความ ข้อมูลหลักสูตร ข่าว และประกาศ"
        action={
          canCreate ? (
            <Button variant="contained" startIcon={<AddIcon />} disabled={contentWritePending} onClick={handleCreate}>
              เพิ่มเนื้อหา
            </Button>
          ) : undefined
        }
      />
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
                      <Typography color="text.secondary">No content records are available.</Typography>
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
        saving={saveMutation.isPending}
        errorMessage={saveError}
        onClose={() => {
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
