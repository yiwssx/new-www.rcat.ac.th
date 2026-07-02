import { ChangeEvent, FormEvent, useMemo, useState } from "react";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../../context/authSessionContext";
import { getAdminCmsSnapshot } from "../../features/cms-dashboard";
import { deleteMediaAsset, mergeBridgeMediaAssets, saveMediaAsset } from "../../features/cms-media";
import { CmsSnapshot, MediaAsset, MediaType } from "../../types";
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

const mediaTypes: MediaType[] = ["image", "document", "sheet", "video"];
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

const loadingModalText = "กรุณารอสักครู่ อย่าปิดหน้านี้";

function getSaveLoadingTitle(operation: MediaSaveOperation) {
  return operation === "update" ? "กำลังบันทึกข้อมูลสื่อ" : "กำลังอัปโหลดสื่อ";
}

function getSavePendingText(operation: MediaSaveOperation) {
  return operation === "update" ? "กำลังบันทึกข้อมูลสื่อ" : "กำลังอัปโหลดไฟล์ไปยัง Drive และบันทึกข้อมูล";
}

function getSaveSuccessTitle(operation: MediaSaveOperation) {
  return operation === "update" ? "อัปเดตสื่อสำเร็จ" : "อัปโหลดสื่อสำเร็จ";
}

function getSaveErrorTitle(operation: MediaSaveOperation) {
  return operation === "update" ? "ไม่สามารถอัปเดตสื่อได้" : "ไม่สามารถอัปโหลดสื่อได้";
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
  const { session } = useAuth();
  const canManage = canManageMedia(session?.user);
  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["cms-snapshot", "admin"],
    queryFn: getAdminCmsSnapshot
  });
  const mediaAssets = useMemo(() => data?.media ?? [], [data?.media]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [form, setForm] = useState<MediaFormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("all");
  const isEditing = Boolean(editingAsset);

  const saveMutation = useMutation({
    mutationFn: saveMediaAsset,
    onSuccess: async (asset) => {
      queryClient.setQueryData<CmsSnapshot>(["cms-snapshot", "admin"], (snapshot) =>
        snapshot
          ? {
              ...snapshot,
              media: mergeBridgeMediaAssets([asset, ...snapshot.media])
            }
          : snapshot
      );
      await invalidatePublicCmsData(queryClient);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMediaAsset,
    onSuccess: async (_, id) => {
      queryClient.setQueryData<CmsSnapshot>(["cms-snapshot", "admin"], (snapshot) =>
        snapshot
          ? {
              ...snapshot,
              media: snapshot.media.filter((asset) => asset.id !== id)
            }
          : snapshot
      );
      await invalidatePublicCmsData(queryClient);
    }
  });
  const mediaActionsDisabled = saveMutation.isPending || deleteMutation.isPending || deletingMediaId !== null;
  const saveOperation: MediaSaveOperation = isEditing ? "update" : "upload";

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mediaAssets.filter((asset) => {
      const matchesType = filter === "all" || asset.type === filter;
      const matchesSearch =
        !query ||
        asset.name.toLowerCase().includes(query) ||
        asset.owner.toLowerCase().includes(query) ||
        asset.type.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [filter, mediaAssets, search]);

  function handleOpenCreate() {
    if (!canManage || mediaActionsDisabled) {
      return;
    }

    setEditingAsset(null);
    setForm(emptyForm);
    setFile(null);
    setFormError("");
    setConfirming(false);
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

    showMediaLoadingModal(getSaveLoadingTitle(saveOperation));

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
      await appSwal.close();
      handleCloseDialog();
      await waitForDialogTransition();
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: getSaveSuccessTitle(saveOperation),
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
    } catch (currentError) {
      const message = getErrorMessage(currentError, "กรุณาตรวจสอบรายละเอียดสื่อ");
      await appSwal.close();
      setFormError(message);
      await appSwal.fire({
        icon: "error",
        title: getSaveErrorTitle(saveOperation),
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
    showMediaLoadingModal("กำลังลบสื่อ");

    try {
      await deleteMutation.mutateAsync(asset.id);
      await appSwal.close();
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ลบสื่อสำเร็จ",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
    } catch (currentError) {
      const message = getErrorMessage(currentError, "กรุณาลองอีกครั้ง");
      await appSwal.close();
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบสื่อได้",
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
      {isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : "ไม่สามารถโหลดรายการสื่อได้ในขณะนี้"}
        </Alert>
      )}
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "center" }}
        sx={{ mb: 2 }}
      >
        <TextField
          placeholder="ค้นหาสื่อ"
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
          value={filter}
          exclusive
          onChange={(_, value: MediaFilter | null) => value && setFilter(value)}
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
      <Grid container spacing={2.5}>
        {filteredAssets.map((asset) => (
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
      {!isLoading && !filteredAssets.length && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          ไม่มีสื่อที่ตรงกับมุมมองนี้
        </Typography>
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
