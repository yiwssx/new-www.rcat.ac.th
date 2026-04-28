import { useCallback, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import {
  deleteContentItem,
  getContentDetail,
  getCmsSnapshot,
  publishContent,
  saveContentItem,
  saveMediaAsset,
  type MediaAssetInput
} from "../services/googleApi";
import { ContentItem, ContentStatus } from "../types";
import { formatDisplayDate } from "../utils/dateDisplay";
import { appSwal } from "../utils/swal";
import { contentStatusLabels, contentTypeLabels } from "../utils/thaiLabels";

const columnHelper = createColumnHelper<ContentItem>();
type FilterStatus = ContentStatus | "all";

function waitForDialogTransition() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 220);
  });
}

export default function ContentPage() {
  const queryClient = useQueryClient();
  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [saveError, setSaveError] = useState("");
  const [loadingEditorItem, setLoadingEditorItem] = useState(false);
  const items = data?.content ?? [];
  const mediaAssets = data?.media ?? [];

  const saveMutation = useMutation({
    mutationFn: saveContentItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContentItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

  const publishMutation = useMutation({
    mutationFn: publishContent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

  const mediaMutation = useMutation({
    mutationFn: saveMediaAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

  const handleEdit = useCallback(async (item: ContentItem) => {
    setSaveError("");
    setLoadingEditorItem(true);

    try {
      const detail = await getContentDetail({ id: item.id });
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
  }, []);

  const handleDelete = useCallback(async (item: ContentItem) => {
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

    try {
      await deleteMutation.mutateAsync(item.id);
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ลบเนื้อหาแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบเนื้อหาได้",
        text: currentError instanceof Error ? currentError.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }, [deleteMutation]);

  const handlePublish = useCallback(async (item: ContentItem) => {
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

    try {
      await publishMutation.mutateAsync(item.id);
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "เผยแพร่เนื้อหาแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถเผยแพร่เนื้อหาได้",
        text: currentError instanceof Error ? currentError.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }, [publishMutation]);

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
              {!!info.row.original.tags?.length && (
                <Typography color="text.secondary" variant="caption">
                  #{info.row.original.tags.slice(0, 3).join(" #")}
                </Typography>
              )}
            </Stack>
            {!!info.row.original.mediaIds?.length && (
              <Typography color="text.secondary" variant="caption">
                สื่อแนบ {info.row.original.mediaIds.length} รายการ
              </Typography>
            )}
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
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="ดูหน้าสาธารณะ">
              <span>
                <IconButton
                  aria-label="ดูหน้าสาธารณะ"
                  component="a"
                  href={`/content/${info.row.original.slug}`}
                  size="small"
                  disabled={
                    info.row.original.status !== "published" && info.row.original.status !== "scheduled"
                  }
                >
                  <OpenInNewRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="แก้ไข">
              <IconButton
                aria-label="แก้ไข"
                size="small"
                disabled={loadingEditorItem}
                onClick={() => void handleEdit(info.row.original)}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {info.row.original.status !== "published" && (
              <Tooltip title="เผยแพร่">
                <IconButton
                  aria-label="เผยแพร่"
                  size="small"
                  color="primary"
                  onClick={() => void handlePublish(info.row.original)}
                >
                  <PublishOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="ลบ">
              <IconButton
                aria-label="ลบ"
                size="small"
                color="error"
                onClick={() => void handleDelete(info.row.original)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )
      })
    ],
    [handleDelete, handleEdit, handlePublish]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus = status === "all" || item.status === status;
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.owner.toLowerCase().includes(query) ||
        (item.category ?? "").toLowerCase().includes(query) ||
        (item.tags ?? []).some((tag) => tag.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [items, search, status]);

  const table = useReactTable({
    data: filteredItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  function handleCreate() {
    setSaveError("");
    setSelectedItem(null);
    setEditorOpen(true);
  }

  async function handleSave(item: ContentItem) {
    try {
      setSaveError("");
      await saveMutation.mutateAsync(item);
      setEditorOpen(false);
      setSelectedItem(null);
      await waitForDialogTransition();
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "บันทึกเนื้อหาแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      setSaveError(currentError instanceof Error ? currentError.message : "กรุณาตรวจสอบรายละเอียดเนื้อหา");
    }
  }

  async function handleUploadMedia(input: MediaAssetInput) {
    return mediaMutation.mutateAsync(input);
  }

  return (
    <Box>
      <PageHeader
        title="เนื้อหา"
        description="สร้างและดูแลหน้าเว็บ บทความ ข้อมูลหลักสูตร ข่าว และประกาศ"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            เพิ่มเนื้อหา
          </Button>
        }
      />
      {isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : "ไม่สามารถโหลดเนื้อหาได้ในขณะนี้"}
        </Alert>
      )}
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", lg: "center" }}
            sx={{ mb: 2 }}
          >
            <TextField
              placeholder="ค้นหาเนื้อหา"
              value={search}
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
            <ToggleButtonGroup
              value={status}
              exclusive
              onChange={(_, value: FilterStatus | null) => value && setStatus(value)}
              size="small"
              aria-label="ตัวกรองสถานะ"
            >
              {(["all", "draft", "review", "scheduled", "published"] as FilterStatus[]).map((item) => (
                <ToggleButton key={item} value={item} sx={{ textTransform: "capitalize" }}>
                  {item === "all" ? "ทั้งหมด" : contentStatusLabels[item]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
          <Box className="table-scroll">
            <MuiTable>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableCell key={header.id} sx={{ fontWeight: 800 }}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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
        </CardContent>
      </Card>
      <ContentEditorDialog
        open={editorOpen}
        item={selectedItem}
        mediaAssets={mediaAssets}
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
