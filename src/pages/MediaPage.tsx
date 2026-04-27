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
  Grid,
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
import { deleteMediaAsset, getCmsSnapshot, saveMediaAsset } from "../services/googleApi";
import { MediaAsset, MediaType } from "../types";
import { formatDisplayDate } from "../utils/dateDisplay";
import { appSwal } from "../utils/swal";
import { formatFileSize, readFileAsBase64 } from "../utils/files";

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
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
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
      setFormError("Name and owner are required.");
      return;
    }

    if (!isEditing && !file) {
      setFormError("Choose a file to upload.");
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
        title: isEditing ? "Media updated" : "Media uploaded",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      setFormError(currentError instanceof Error ? currentError.message : "Please check the media details.");
      setConfirming(false);
    }
  }

  async function handleDelete(asset: MediaAsset) {
    const result = await appSwal.fire({
      title: "Delete media?",
      text: `${asset.name} will be removed from the library and moved to trash in Drive when possible.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel"
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
        title: "Media deleted",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      await appSwal.fire({
        icon: "error",
        title: "Unable to delete media",
        text: currentError instanceof Error ? currentError.message : "Please try again.",
        confirmButtonText: "OK"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="Media Library"
        description="Upload, edit, delete, and reuse Drive-backed photos, videos, documents, and sheets."
        action={
          <Button variant="contained" startIcon={<UploadFileOutlinedIcon />} onClick={handleOpenCreate}>
            Add media
          </Button>
        }
      />
      {isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : "Unable to load media items right now."}
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
          placeholder="Search media"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon />
              </InputAdornment>
            )
          }}
          sx={{ minWidth: { lg: 360 } }}
        />
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, value: MediaFilter | null) => value && setFilter(value)}
          size="small"
          aria-label="Media type filter"
        >
          {(["all", ...mediaTypes] as MediaFilter[]).map((item) => (
            <ToggleButton key={item} value={item} sx={{ textTransform: "capitalize" }}>
              {item}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <Grid container spacing={2.5}>
        {filteredAssets.map((asset) => (
          <Grid item xs={12} sm={6} lg={4} xl={3} key={asset.id}>
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
                  <Chip label={asset.type} size="small" sx={{ textTransform: "capitalize" }} />
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
                  <Tooltip title={asset.driveUrl ? "Open in Drive" : "No Drive URL"}>
                    <span>
                      <IconButton
                        aria-label="Open asset"
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
                  <Tooltip title="Edit media">
                    <IconButton aria-label="Edit media" size="small" onClick={() => handleOpenEdit(asset)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete media">
                    <IconButton
                      aria-label="Delete media"
                      size="small"
                      color="error"
                      onClick={() => void handleDelete(asset)}
                    >
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
          No media assets match this view.
        </Typography>
      )}
      <Dialog open={dialogOpen} onClose={saveMutation.isPending ? undefined : handleCloseDialog} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>{confirming ? (isEditing ? "Save media changes?" : "Upload media?") : isEditing ? "Edit media" : "Add media"}</DialogTitle>
          <DialogContent dividers>
            {confirming ? (
              <Stack spacing={1.5} sx={{ pt: 1 }}>
                {formError && <Alert severity="error">{formError}</Alert>}
                <Typography color="text.secondary">
                  Confirm this media item before saving.
                </Typography>
                <Typography fontWeight={900}>{form.name}</Typography>
                <Typography color="text.secondary">
                  {form.type} / {form.owner} {file ? `/ ${file.name}` : ""}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2.2} sx={{ pt: 1 }}>
                {formError && <Alert severity="error">{formError}</Alert>}
                <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />}>
                  {file ? "Replace file" : "Choose file"}
                  <input hidden type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={handleFileChange} />
                </Button>
                {file && (
                  <Typography color="text.secondary" variant="body2">
                    {file.name} / {formatFileSize(file.size)}
                  </Typography>
                )}
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  fullWidth
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    label="Type"
                    value={form.type}
                    onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as MediaType }))}
                    select
                    fullWidth
                  >
                    {mediaTypes.map((type) => (
                      <MenuItem key={type} value={type} sx={{ textTransform: "capitalize" }}>
                        {type}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Owner"
                    value={form.owner}
                    onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                    required
                    fullWidth
                  />
                </Stack>
                <TextField
                  label="Custom Drive URL (optional)"
                  value={form.driveUrl}
                  onChange={(event) => setForm((current) => ({ ...current, driveUrl: event.target.value }))}
                  placeholder="Leave blank to let Apps Script generate the Drive URL"
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
                  Back
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  disabled={saveMutation.isPending}
                  onClick={() => void handleConfirmSave()}
                >
                  {saveMutation.isPending ? "Saving" : isEditing ? "Save" : "Upload"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" color="inherit" onClick={handleCloseDialog} disabled={saveMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
                  Continue
                </Button>
              </>
            )}
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
