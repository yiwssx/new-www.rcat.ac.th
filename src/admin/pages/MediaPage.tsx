import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import AdminPagination from "../components/AdminPagination";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../../context/authSessionContext";
import { deleteMediaAsset, MAX_MEDIA_UPLOAD_BYTES, saveMediaAsset } from "../../features/cms-media";
import { MediaAsset, MediaType } from "../../types";
import {
  ADMIN_MEDIA_PAGE_SIZE_OPTIONS,
  getAdminPageAfterDelete,
  invalidateAdminListQueries,
  useAdminListUrlState,
  useAdminMediaListQuery,
  useDebouncedValue
} from "../../features/admin-pagination";
import { formatDisplayDate } from "../../utils/dateDisplay";
import { appSwal } from "../../utils/swal";
import { formatFileSize, readFileAsBase64 } from "../../utils/files";
import { mediaTypeLabels } from "../../utils/thaiLabels";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { ADMIN_READ_ONLY_NOTICE, canManageMedia } from "../utils/rbac";

interface MediaFormState {
  name: string;
  type: MediaType;
  owner: string;
  driveUrl: string;
}

type MediaFilter = MediaType | "all";
type MediaFilterKey = "type";

const mediaTypes: MediaType[] = ["image", "document", "sheet", "video"];
const mediaListUrlOptions = {
  defaultPageSize: 24,
  pageSizeOptions: ADMIN_MEDIA_PAGE_SIZE_OPTIONS,
  defaultSortBy: "updatedAt",
  defaultSortDirection: "desc" as const,
  filterDefaults: { type: "all" }
};
const emptyForm: MediaFormState = {
  name: "",
  type: "image",
  owner: "",
  driveUrl: ""
};

function waitForDialogTransition() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 220);
  });
}

function inferMediaType(file: File): MediaType {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.includes("spreadsheet") || file.name.match(/\.(csv|xls|xlsx)$/i)) {
    return "sheet";
  }

  return "document";
}

function getMediaIcon(type: MediaAsset["type"]) {
  if (type === "image") {
    return <ImageOutlinedIcon />;
  }

  if (type === "sheet") {
    return <TableChartOutlinedIcon />;
  }

  if (type === "video") {
    return <OndemandVideoOutlinedIcon />;
  }

  return <DescriptionOutlinedIcon />;
}

function toFormState(asset: MediaAsset): MediaFormState {
  return {
    name: asset.name,
    type: asset.type,
    owner: asset.owner,
    driveUrl: asset.driveUrl
  };
}

function MediaPreview({ asset }: { asset: MediaAsset }) {
  const previewUrl = asset.thumbnailUrl || asset.previewUrl || "";
  const [previewFailed, setPreviewFailed] = useState(false);

  if (asset.type !== "image") {
    return <Box sx={{ fontSize: 46, display: "grid", placeItems: "center" }}>{getMediaIcon(asset.type)}</Box>;
  }

  if (!previewUrl || previewFailed) {
    return (
      <Stack spacing={1} alignItems="center" sx={{ px: 2, textAlign: "center" }}>
        <Box sx={{ fontSize: 40, display: "grid", placeItems: "center" }}>{getMediaIcon(asset.type)}</Box>
        <Typography color="text.secondary" variant="body2">
          ไม่สามารถแสดงตัวอย่างได้
        </Typography>
      </Stack>
    );
  }

  return (
    <Box
      component="img"
      src={previewUrl}
      alt={asset.name}
      loading="lazy"
      onError={() => setPreviewFailed(true)}
      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

interface MediaAssetCardProps {
  asset: MediaAsset;
  canManage?: boolean;
  actionsDisabled?: boolean;
  isDeleting?: boolean;
  onEdit: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
}

export function MediaAssetCard({
  asset,
  canManage = true,
  actionsDisabled = false,
  isDeleting = false,
  onEdit,
  onDelete
}: MediaAssetCardProps) {
  const previewKey = `${asset.id}:${asset.thumbnailUrl || asset.previewUrl || "missing"}`;
  const driveActionDisabled = actionsDisabled || !asset.driveUrl;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box
          sx={{
            height: 170,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            color: "primary.main",
            backgroundColor: "primary.light",
            overflow: "hidden",
            mb: 2
          }}
        >
          <MediaPreview key={previewKey} asset={asset} />
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" sx={{ fontSize: "1.05rem" }} noWrap>
              {asset.name}
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              {asset.owner}
            </Typography>
          </Box>
          <Chip label={mediaTypeLabels[asset.type]} size="small" />
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.6 }}>
          <Typography color="text.secondary" variant="body2">
            {asset.size || asset.mimeType || "Drive"}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {formatDisplayDate(asset.updatedAt)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mt: 2 }}>
          <Tooltip title={asset.driveUrl ? "เปิดใน Drive" : "ไม่มี URL ของ Drive"}>
            <span>
              <IconButton
                aria-label="เปิดสื่อ"
                component="a"
                href={driveActionDisabled ? undefined : asset.driveUrl}
                target="_blank"
                rel="noreferrer"
                disabled={driveActionDisabled}
                size="small"
              >
                <OpenInNewRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {canManage && (
            <>
              <Tooltip title="แก้ไขสื่อ">
                <span>
                  <IconButton
                    aria-label="แก้ไขสื่อ"
                    size="small"
                    disabled={actionsDisabled}
                    onClick={() => onEdit(asset)}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={isDeleting ? "กำลังลบ" : "ลบสื่อ"}>
                <span>
                  <IconButton
                    aria-label="ลบสื่อ"
                    size="small"
                    color="error"
                    disabled={actionsDisabled}
                    onClick={() => onDelete(asset)}
                  >
                    {isDeleting ? (
                      <>
                        <CircularProgress size={18} color="inherit" aria-hidden="true" />
                        <Box
                          component="span"
                          sx={{
                            position: "absolute",
                            width: 1,
                            height: 1,
                            p: 0,
                            m: -1,
                            overflow: "hidden",
                            clip: "rect(0 0 0 0)",
                            whiteSpace: "nowrap",
                            border: 0
                          }}
                        >
                          กำลังลบ
                        </Box>
                      </>
                    ) : (
                      <DeleteOutlineIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

type MediaSaveOperation = "upload" | "update";
type OperationNotice = {
  severity: "success" | "error";
  message: string;
};

const loadingModalText = "กรุณารอสักครู่ อย่าปิดหน้านี้";
const deleteSuccessTitle = "ลบสื่อสำเร็จ";
const deleteSuccessText = "ระบบนำสื่อออกจากคลังเรียบร้อยแล้ว";

function getSaveLoadingTitle(operation: MediaSaveOperation) {
  return operation === "update" ? "กำลังบันทึกข้อมูลสื่อ" : "กำลังอัปโหลดสื่อ";
}

function getSavePendingText(operation: MediaSaveOperation) {
  return operation === "update" ? "กำลังบันทึกข้อมูลสื่อ" : "กำลังอัปโหลดไฟล์ไปยัง Drive และบันทึกข้อมูล";
}

function getSaveSuccessTitle(operation: MediaSaveOperation) {
  return operation === "update" ? "อัปเดตสื่อสำเร็จ" : "อัปโหลดสื่อสำเร็จ";
}

function getSaveSuccessText(operation: MediaSaveOperation) {
  return operation === "update"
    ? "ระบบบันทึกการแก้ไขข้อมูลสื่อเรียบร้อยแล้ว"
    : "ระบบบันทึกสื่อและอัปเดตรายการเรียบร้อยแล้ว";
}

function getSaveErrorTitle(operation: MediaSaveOperation) {
  return operation === "update" ? "ไม่สามารถอัปเดตสื่อได้" : "ไม่สามารถอัปโหลดสื่อได้";
}

function formatOperationNotice(title: string, text: string) {
  return `${title}: ${text}`;
}

function getErrorMessage(currentError: unknown, fallback: string) {
  return currentError instanceof Error ? currentError.message : fallback;
}

function showMediaLoadingModal(title: string) {
  void appSwal.fire({
    title,
    text: loadingModalText,
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      void appSwal.showLoading();
    }
  });
}

export default function MediaPage() {
  const queryClient = useQueryClient();
  const { capabilities } = useAuth();
  const canManage = canManageMedia(capabilities);
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
  } = useAdminListUrlState<MediaFilterKey>(mediaListUrlOptions);
  const debouncedSearch = useDebouncedValue(q, 300);
  const filter = (filters.type || "all") as MediaFilter;
  const mediaListQuery = useAdminMediaListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    type: filter,
    sortBy,
    sortDirection
  });
  const listTransitioning = mediaListQuery.isPlaceholderData || debouncedSearch !== q;
  const mediaAssets = mediaListQuery.data?.items ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [form, setForm] = useState<MediaFormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState<OperationNotice | null>(null);
  const isEditing = Boolean(editingAsset);

  useEffect(() => {
    const responsePage = mediaListQuery.data?.pagination.page;

    if (!mediaListQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState({ page: responsePage }, { replace: true });
    }
  }, [mediaListQuery.data?.pagination.page, mediaListQuery.isPlaceholderData, page, setListState]);

  const saveMutation = useMutation({
    mutationFn: saveMediaAsset
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMediaAsset
  });
  const mediaActionsDisabled =
    saveMutation.isPending || deleteMutation.isPending || deletingMediaId !== null || listTransitioning;
  const saveOperation: MediaSaveOperation = isEditing ? "update" : "upload";

  function handleOpenCreate() {
    if (!canManage || mediaActionsDisabled) {
      return;
    }

    setEditingAsset(null);
    setForm(emptyForm);
    setFile(null);
    setFormError("");
    setConfirming(false);
    setOperationNotice(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(asset: MediaAsset) {
    if (!canManage || mediaActionsDisabled) {
      return;
    }

    setEditingAsset(asset);
    setForm(toFormState(asset));
    setFile(null);
    setFormError("");
    setConfirming(false);
    setOperationNotice(null);
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    setDialogOpen(false);
    setEditingAsset(null);
    setForm(emptyForm);
    setFile(null);
    setFormError("");
    setConfirming(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!canManage || mediaActionsDisabled) {
      return;
    }

    const nextFile = event.target.files?.[0] ?? null;

    if (nextFile && nextFile.size > MAX_MEDIA_UPLOAD_BYTES) {
      setFile(null);
      setFormError("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
      event.target.value = "";
      return;
    }

    setFile(nextFile);
    setFormError("");

    if (nextFile) {
      setForm((current) => ({
        ...current,
        name: current.name || nextFile.name.replace(/\.[^.]+$/, ""),
        type: inferMediaType(nextFile)
      }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      setFormError(ADMIN_READ_ONLY_NOTICE);
      return;
    }

    if (mediaActionsDisabled) {
      return;
    }

    setOperationNotice(null);

    if (!form.name.trim() || !form.owner.trim()) {
      setFormError("ต้องระบุชื่อและผู้รับผิดชอบ");
      return;
    }

    if (!isEditing && !file) {
      setFormError("กรุณาเลือกไฟล์เพื่ออัปโหลด");
      return;
    }

    setFormError("");
    setConfirming(true);
  }

  async function handleConfirmSave() {
    if (!canManage) {
      setFormError(ADMIN_READ_ONLY_NOTICE);
      return;
    }

    if (mediaActionsDisabled) {
      return;
    }

    if (file && file.size > MAX_MEDIA_UPLOAD_BYTES) {
      setFormError("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
      setFile(null);
      return;
    }

    const currentOperation = saveOperation;
    showMediaLoadingModal(getSaveLoadingTitle(currentOperation));

    try {
      const filePayload = file
        ? {
            size: formatFileSize(file.size),
            fileName: file.name,
            fileBase64: await readFileAsBase64(file),
            mimeType: file.type
          }
        : {};

      await saveMutation.mutateAsync({
        id: editingAsset?.id,
        name: form.name.trim(),
        type: form.type,
        owner: form.owner.trim(),
        driveUrl: form.driveUrl.trim() || editingAsset?.driveUrl || "",
        fileId: editingAsset?.fileId,
        thumbnailUrl: editingAsset?.thumbnailUrl,
        previewUrl: editingAsset?.previewUrl,
        embedUrl: editingAsset?.embedUrl,
        mimeType: editingAsset?.mimeType,
        size: editingAsset?.size,
        ...filePayload
      });
      if (currentOperation === "upload") {
        setListState({ page: 1 }, { replace: true });
      }
      await Promise.all([invalidateAdminListQueries(queryClient, "media"), invalidatePublicCmsData(queryClient)]);
      await appSwal.close();
      const successTitle = getSaveSuccessTitle(currentOperation);
      const successText = getSaveSuccessText(currentOperation);
      handleCloseDialog();
      setOperationNotice({
        severity: "success",
        message: formatOperationNotice(successTitle, successText)
      });
      await waitForDialogTransition();
      await appSwal.fire({
        icon: "success",
        title: successTitle,
        text: successText,
        confirmButtonText: "ตกลง"
      });
    } catch (currentError) {
      const message = getErrorMessage(currentError, "กรุณาตรวจสอบรายละเอียดสื่อ");
      const errorTitle = getSaveErrorTitle(currentOperation);
      await appSwal.close();
      setFormError(message);
      setOperationNotice({
        severity: "error",
        message: formatOperationNotice(errorTitle, message)
      });
      await appSwal.fire({
        icon: "error",
        title: errorTitle,
        text: message,
        confirmButtonText: "ตกลง"
      });
    }
  }

  async function handleDelete(asset: MediaAsset) {
    if (!canManage || mediaActionsDisabled) {
      return;
    }

    const result = await appSwal.fire({
      title: "ลบสื่อ?",
      text: `${asset.name} จะถูกนำออกจากคลังและย้ายไปถังขยะใน Drive หากทำได้`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    setDeletingMediaId(asset.id);
    setOperationNotice(null);
    showMediaLoadingModal("กำลังลบสื่อ");

    try {
      await deleteMutation.mutateAsync(asset);
      const pagination = mediaListQuery.data?.pagination;

      if (pagination) {
        const nextPage = getAdminPageAfterDelete(pagination);
        if (nextPage !== page) {
          setListState({ page: nextPage }, { replace: true });
        }
      }

      await Promise.all([invalidateAdminListQueries(queryClient, "media"), invalidatePublicCmsData(queryClient)]);
      await appSwal.close();
      setOperationNotice({
        severity: "success",
        message: formatOperationNotice(deleteSuccessTitle, deleteSuccessText)
      });
      await appSwal.fire({
        icon: "success",
        title: deleteSuccessTitle,
        text: deleteSuccessText,
        confirmButtonText: "ตกลง"
      });
    } catch (currentError) {
      const message = getErrorMessage(currentError, "กรุณาลองอีกครั้ง");
      const errorTitle = "ไม่สามารถลบสื่อได้";
      await appSwal.close();
      setOperationNotice({
        severity: "error",
        message: formatOperationNotice(errorTitle, message)
      });
      await appSwal.fire({
        icon: "error",
        title: errorTitle,
        text: message,
        confirmButtonText: "ตกลง"
      });
    } finally {
      setDeletingMediaId(null);
    }
  }

  return (
    <Box>
      <PageHeader
        title="คลังสื่อ"
        description="อัปโหลด แก้ไข ลบ และนำรูปภาพ วิดีโอ เอกสาร และตารางข้อมูลจาก Drive มาใช้ซ้ำ"
        action={
          canManage ? (
            <Button
              variant="contained"
              startIcon={<UploadFileOutlinedIcon />}
              disabled={mediaActionsDisabled}
              onClick={handleOpenCreate}
            >
              เพิ่มสื่อ
            </Button>
          ) : undefined
        }
      />
      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}
      {mediaListQuery.isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {mediaListQuery.error instanceof Error ? mediaListQuery.error.message : "ไม่สามารถโหลดรายการสื่อได้ในขณะนี้"}
        </Alert>
      )}
      {mediaListQuery.isLoading && <LinearProgress sx={{ mb: 3 }} />}
      {(mediaListQuery.isFetching || listTransitioning) && !mediaListQuery.isLoading && (
        <LinearProgress sx={{ mb: 1 }} />
      )}
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
        sx={{ mb: 2 }}
      >
        <TextField
          placeholder="ค้นหาสื่อ"
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
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, value: MediaFilter | null) => value && setFilter("type", value)}
          size="small"
          aria-label="ตัวกรองประเภทสื่อ"
        >
          {(["all", ...mediaTypes] as MediaFilter[]).map((item) => (
            <ToggleButton key={item} value={item} sx={{ textTransform: "capitalize" }}>
              {item === "all" ? "ทั้งหมด" : mediaTypeLabels[item]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      {operationNotice && (
        <Alert severity={operationNotice.severity} sx={{ mb: 2 }}>
          {operationNotice.message}
        </Alert>
      )}
      <Grid
        container
        spacing={2.5}
        aria-busy={mediaListQuery.isFetching}
        sx={{ opacity: listTransitioning ? 0.55 : 1, transition: "opacity 120ms ease" }}
      >
        {mediaAssets.map((asset) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 3 }} key={asset.id}>
            <MediaAssetCard
              asset={asset}
              canManage={canManage}
              actionsDisabled={mediaActionsDisabled}
              isDeleting={deletingMediaId === asset.id}
              onEdit={handleOpenEdit}
              onDelete={(currentAsset) => void handleDelete(currentAsset)}
            />
          </Grid>
        ))}
      </Grid>
      {!mediaListQuery.isLoading && !mediaAssets.length && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          ไม่มีสื่อที่ตรงกับมุมมองนี้
        </Typography>
      )}
      {mediaListQuery.data && (
        <AdminPagination
          pagination={{
            ...mediaListQuery.data.pagination,
            page,
            pageSize
          }}
          pageSizeOptions={ADMIN_MEDIA_PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          disabled={mediaActionsDisabled}
          isFetching={mediaListQuery.isFetching}
        />
      )}
      <Dialog
        open={dialogOpen}
        onClose={saveMutation.isPending ? undefined : handleCloseDialog}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {confirming ? (isEditing ? "บันทึกการแก้ไขสื่อ?" : "อัปโหลดสื่อ?") : isEditing ? "แก้ไขสื่อ" : "เพิ่มสื่อ"}
          </DialogTitle>
          <DialogContent dividers>
            {confirming ? (
              <Stack spacing={1.5} sx={{ pt: 1 }}>
                {formError && <Alert severity="error">{formError}</Alert>}
                {saveMutation.isPending && (
                  <Stack spacing={1}>
                    <LinearProgress />
                    <Typography color="text.secondary">{getSavePendingText(saveOperation)}</Typography>
                  </Stack>
                )}
                <Typography color="text.secondary">ตรวจสอบสื่อนี้ก่อนบันทึก</Typography>
                <Typography fontWeight={900}>{form.name}</Typography>
                <Typography color="text.secondary">
                  {mediaTypeLabels[form.type]} / {form.owner} {file ? `/ ${file.name}` : ""}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2.2} sx={{ pt: 1 }}>
                {formError && <Alert severity="error">{formError}</Alert>}
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileOutlinedIcon />}
                  disabled={!canManage || mediaActionsDisabled}
                >
                  {file ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}
                  <input
                    hidden
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                    onChange={handleFileChange}
                  />
                </Button>
                <Typography color="text.secondary" variant="body2">
                  รองรับไฟล์ขนาดไม่เกิน 10 MB
                </Typography>
                {file && (
                  <Typography color="text.secondary" variant="body2">
                    {file.name} / {formatFileSize(file.size)}
                  </Typography>
                )}
                <TextField
                  label="ชื่อ"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  fullWidth
                  disabled={mediaActionsDisabled}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    label="ประเภท"
                    value={form.type}
                    onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as MediaType }))}
                    select
                    fullWidth
                    disabled={mediaActionsDisabled}
                  >
                    {mediaTypes.map((type) => (
                      <MenuItem key={type} value={type} sx={{ textTransform: "capitalize" }}>
                        {mediaTypeLabels[type]}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="ผู้รับผิดชอบ"
                    value={form.owner}
                    onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                    required
                    fullWidth
                    disabled={mediaActionsDisabled}
                  />
                </Stack>
                <TextField
                  label="URL ของ Drive กำหนดเอง (ไม่บังคับ)"
                  value={form.driveUrl}
                  onChange={(event) => setForm((current) => ({ ...current, driveUrl: event.target.value }))}
                  placeholder="เว้นว่างเพื่อให้ Apps Script สร้าง URL ของ Drive"
                  fullWidth
                  disabled={mediaActionsDisabled}
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            {confirming ? (
              <>
                <Button
                  type="button"
                  color="inherit"
                  onClick={() => setConfirming(false)}
                  disabled={!canManage || saveMutation.isPending}
                >
                  กลับ
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  disabled={saveMutation.isPending}
                  onClick={() => void handleConfirmSave()}
                >
                  {saveMutation.isPending ? "กำลังบันทึก" : isEditing ? "บันทึก" : "อัปโหลด"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" color="inherit" onClick={handleCloseDialog} disabled={saveMutation.isPending}>
                  ยกเลิก
                </Button>
                <Button type="submit" variant="contained" disabled={!canManage || saveMutation.isPending}>
                  ดำเนินการต่อ
                </Button>
              </>
            )}
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
