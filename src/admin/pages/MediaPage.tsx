import { ChangeEvent, FormEvent, useMemo, useState } from "react";
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
import { deleteMediaAsset, getAdminCmsSnapshot, saveMediaAsset } from "../../services/googleApi";
import { MediaAsset, MediaType } from "../../types";
import { formatDisplayDate } from "../../utils/dateDisplay";
import { appSwal } from "../../utils/swal";
import { formatFileSize, readFileAsBase64 } from "../../utils/files";
import { mediaTypeLabels } from "../../utils/thaiLabels";

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

export default function MediaPage() {
  const queryClient = useQueryClient();
  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["cms-snapshot", "admin"],
    queryFn: getAdminCmsSnapshot
  });
  const mediaAssets = data?.media ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [form, setForm] = useState<MediaFormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("all");
  const isEditing = Boolean(editingAsset);

  const saveMutation = useMutation({
    mutationFn: saveMediaAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMediaAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

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
    setEditingAsset(null);
    setForm(emptyForm);
    setFile(null);
    setFormError("");
    setConfirming(false);
    setDialogOpen(true);
  }

  function handleOpenEdit(asset: MediaAsset) {
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
        previewUrl: editingAsset?.previewUrl,
        embedUrl: editingAsset?.embedUrl,
        mimeType: editingAsset?.mimeType,
        size: editingAsset?.size,
        ...filePayload
      });
      handleCloseDialog();
      await waitForDialogTransition();
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isEditing ? "อัปเดตสื่อแล้ว" : "อัปโหลดสื่อแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      setFormError(currentError instanceof Error ? currentError.message : "กรุณาตรวจสอบรายละเอียดสื่อ");
      setConfirming(false);
    }
  }

  async function handleDelete(asset: MediaAsset) {
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

    try {
      await deleteMutation.mutateAsync(asset.id);
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ลบสื่อแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบสื่อได้",
        text: currentError instanceof Error ? currentError.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="คลังสื่อ"
        description="อัปโหลด แก้ไข ลบ และนำรูปภาพ วิดีโอ เอกสาร และตารางข้อมูลจาก Drive มาใช้ซ้ำ"
        action={
          <Button variant="contained" startIcon={<UploadFileOutlinedIcon />} onClick={handleOpenCreate}>
            เพิ่มสื่อ
          </Button>
        }
      />
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
                  {asset.type === "image" && asset.previewUrl ? (
                    <Box
                      component="img"
                      src={asset.previewUrl}
                      alt={asset.name}
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Box sx={{ fontSize: 46, display: "grid", placeItems: "center" }}>{getMediaIcon(asset.type)}</Box>
                  )}
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
                        href={asset.driveUrl || undefined}
                        target="_blank"
                        rel="noreferrer"
                        disabled={!asset.driveUrl}
                        size="small"
                      >
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="แก้ไขสื่อ">
                    <IconButton aria-label="แก้ไขสื่อ" size="small" onClick={() => handleOpenEdit(asset)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="ลบสื่อ">
                    <IconButton aria-label="ลบสื่อ" size="small" color="error" onClick={() => void handleDelete(asset)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
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
                <Typography color="text.secondary">ตรวจสอบสื่อนี้ก่อนบันทึก</Typography>
                <Typography fontWeight={900}>{form.name}</Typography>
                <Typography color="text.secondary">
                  {mediaTypeLabels[form.type]} / {form.owner} {file ? `/ ${file.name}` : ""}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2.2} sx={{ pt: 1 }}>
                {formError && <Alert severity="error">{formError}</Alert>}
                <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />}>
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
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    label="ประเภท"
                    value={form.type}
                    onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as MediaType }))}
                    select
                    fullWidth
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
                  />
                </Stack>
                <TextField
                  label="URL ของ Drive กำหนดเอง (ไม่บังคับ)"
                  value={form.driveUrl}
                  onChange={(event) => setForm((current) => ({ ...current, driveUrl: event.target.value }))}
                  placeholder="เว้นว่างเพื่อให้ Apps Script สร้าง URL ของ Drive"
                  fullWidth
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
                  disabled={saveMutation.isPending}
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
                <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
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
