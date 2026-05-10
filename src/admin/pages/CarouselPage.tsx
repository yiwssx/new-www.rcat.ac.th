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
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ViewCarouselOutlinedIcon from "@mui/icons-material/ViewCarouselOutlined";
import PageHeader from "../components/PageHeader";
import { deleteCarouselSlideFromApi, getAdminCmsSnapshot, saveCarouselSlideToApi } from "../../services/googleApi";
import { clearPublicCmsCache } from "../../services/publicCmsCache";
import { CarouselSlide, MediaAsset } from "../../types";
import { formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { appSwal } from "../../utils/swal";

function sortCarouselSlides(slides: CarouselSlide[]) {
  return [...slides].sort((left, right) => {
    const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : 0;
    const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : 0;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "");
  });
}

function getMediaImageUrl(asset: MediaAsset) {
  return asset.previewUrl || asset.driveUrl || asset.embedUrl || "";
}

function getCarouselImageMedia(mediaAssets: MediaAsset[]) {
  return mediaAssets
    .filter((asset) => asset.type === "image" && getMediaImageUrl(asset))
    .sort((left, right) => Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""));
}

function isSelectedCarouselImage(slide: CarouselSlide, asset: MediaAsset) {
  return Boolean(slide.imageUrl && slide.imageUrl === getMediaImageUrl(asset));
}

function toLocalDateTimeInputValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeInputValue(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function createCarouselDraft(order: number): CarouselSlide {
  const now = new Date().toISOString();

  return {
    id: `carousel-${Date.now()}`,
    title: "",
    subtitle: "",
    chip: "ประชาสัมพันธ์",
    imageUrl: "",
    imageAlt: "",
    buttonLabel: "อ่านต่อ",
    href: "/",
    enabled: false,
    order,
    startAt: "",
    endAt: "",
    updatedAt: now
  };
}

function normalizeCarouselDraft(slide: CarouselSlide): CarouselSlide {
  const title = slide.title.trim();
  const order = Number(slide.order);

  return {
    ...slide,
    title,
    subtitle: slide.subtitle.trim(),
    chip: slide.chip.trim() || "ประชาสัมพันธ์",
    imageUrl: slide.imageUrl.trim(),
    imageAlt: slide.imageAlt.trim() || title,
    buttonLabel: slide.buttonLabel.trim() || "อ่านต่อ",
    href: slide.href.trim() || "/",
    enabled: Boolean(slide.enabled),
    order: Number.isFinite(order) ? order : 0,
    startAt: slide.startAt || "",
    endAt: slide.endAt || ""
  };
}

function getDateRangeLabel(slide: CarouselSlide) {
  if (slide.startAt && slide.endAt) {
    return `${formatDisplayDateTime(slide.startAt)} - ${formatDisplayDateTime(slide.endAt)}`;
  }

  if (slide.startAt) {
    return `เริ่ม ${formatDisplayDateTime(slide.startAt)}`;
  }

  if (slide.endAt) {
    return `สิ้นสุด ${formatDisplayDateTime(slide.endAt)}`;
  }

  return "";
}

export default function CarouselPage() {
  const queryClient = useQueryClient();
  const adminSnapshotQuery = useQuery({
    queryKey: ["cms-snapshot", "admin"],
    queryFn: getAdminCmsSnapshot
  });
  const slides = useMemo(
    () => sortCarouselSlides(adminSnapshotQuery.data?.carouselSlides ?? []),
    [adminSnapshotQuery.data?.carouselSlides]
  );
  const imageMediaAssets = useMemo(
    () => getCarouselImageMedia(adminSnapshotQuery.data?.media ?? []),
    [adminSnapshotQuery.data?.media]
  );
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const saveCarouselMutation = useMutation({
    mutationFn: saveCarouselSlideToApi
  });
  const deleteCarouselMutation = useMutation({
    mutationFn: deleteCarouselSlideFromApi
  });

  function updateEditingSlide<K extends keyof CarouselSlide>(key: K, value: CarouselSlide[K]) {
    setEditingSlide((current) =>
      current
        ? {
            ...current,
            [key]: value
          }
        : current
    );
  }

  function handleAddSlide() {
    setEditingSlide(createCarouselDraft(slides.length + 1));
    setIsCreating(true);
    setDialogOpen(true);
  }

  function handleEditSlide(slide: CarouselSlide) {
    setEditingSlide({
      ...slide,
      startAt: slide.startAt || "",
      endAt: slide.endAt || ""
    });
    setIsCreating(false);
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    if (saveCarouselMutation.isPending) {
      return;
    }

    setDialogOpen(false);
    setEditingSlide(null);
    setIsCreating(false);
  }

  function handleSelectMediaImage(asset: MediaAsset) {
    const imageUrl = getMediaImageUrl(asset);

    if (!imageUrl) {
      return;
    }

    setEditingSlide((current) =>
      current
        ? {
            ...current,
            imageUrl,
            imageAlt: current.imageAlt.trim() || asset.name || current.title
          }
        : current
    );
  }

  async function invalidateCarouselData() {
    clearPublicCmsCache();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["cms-snapshot", "admin"] })
    ]);
  }

  async function handleSaveCarouselSlide() {
    if (!editingSlide) {
      return;
    }

    const nextSlide = normalizeCarouselDraft(editingSlide);

    if (!nextSlide.title) {
      await appSwal.fire({
        icon: "warning",
        title: "กรุณาระบุชื่อสไลด์",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    if (!nextSlide.imageUrl) {
      await appSwal.fire({
        icon: "warning",
        title: "กรุณาระบุ URL รูปภาพ",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    const startAtMs = nextSlide.startAt ? Date.parse(nextSlide.startAt) : Number.NaN;
    const endAtMs = nextSlide.endAt ? Date.parse(nextSlide.endAt) : Number.NaN;

    if (Number.isFinite(startAtMs) && Number.isFinite(endAtMs) && endAtMs < startAtMs) {
      await appSwal.fire({
        icon: "warning",
        title: "ช่วงเวลาไม่ถูกต้อง",
        text: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    try {
      const saved = await saveCarouselMutation.mutateAsync(nextSlide);
      setEditingSlide(saved);
      handleCloseDialog();
      await invalidateCarouselData();
      await appSwal.fire({
        icon: "success",
        title: "บันทึกสไลด์หน้าแรกแล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกสไลด์หน้าแรกได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  async function handleDeleteCarouselSlide(slide: CarouselSlide) {
    const result = await appSwal.fire({
      icon: "warning",
      title: "ลบสไลด์หน้าแรก?",
      text: slide.title,
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await deleteCarouselMutation.mutateAsync(slide.id);
      await invalidateCarouselData();
      await appSwal.fire({
        icon: "success",
        title: "ลบสไลด์หน้าแรกแล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบสไลด์หน้าแรกได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="สไลด์หน้าแรก"
        description="จัดการสไลด์ประชาสัมพันธ์ที่แสดงใน Carousel หน้าแรก"
        action={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleAddSlide}>
            เพิ่มสไลด์
          </Button>
        }
      />

      {adminSnapshotQuery.isLoading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color="text.secondary">กำลังโหลดสไลด์หน้าแรก...</Typography>
          </CardContent>
        </Card>
      )}

      {adminSnapshotQuery.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {adminSnapshotQuery.error instanceof Error
            ? adminSnapshotQuery.error.message
            : "ไม่สามารถโหลดสไลด์หน้าแรกได้"}
        </Alert>
      )}

      {!adminSnapshotQuery.isLoading && !adminSnapshotQuery.isError && !slides.length && (
        <Card>
          <CardContent>
            <Stack spacing={2} alignItems="flex-start">
              <ViewCarouselOutlinedIcon color="primary" sx={{ fontSize: 44 }} />
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                  ยังไม่มีสไลด์หน้าแรก
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  เพิ่มสไลด์เพื่อแสดงภาพประชาสัมพันธ์ใน Carousel หน้าแรก
                </Typography>
              </Box>
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleAddSlide}>
                เพิ่มสไลด์
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2.5}>
        {slides.map((slide) => {
          const dateRangeLabel = getDateRangeLabel(slide);

          return (
            <Grid key={slide.id} size={{ xs: 12, md: 6, xl: 4 }}>
              <Card sx={{ height: "100%" }}>
                <Box
                  sx={{
                    height: 180,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "primary.light",
                    color: "primary.main",
                    overflow: "hidden"
                  }}
                >
                  {slide.imageUrl ? (
                    <Box
                      component="img"
                      src={slide.imageUrl}
                      alt={slide.imageAlt || slide.title}
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Typography fontWeight={800}>ยังไม่มีรูปภาพ</Typography>
                  )}
                </Box>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip label={slide.chip || "ประชาสัมพันธ์"} size="small" color="secondary" />
                      <Chip
                        label={slide.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        size="small"
                        color={slide.enabled ? "success" : "warning"}
                        variant={slide.enabled ? "filled" : "outlined"}
                      />
                      <Chip label={`ลำดับ ${slide.order}`} size="small" variant="outlined" />
                    </Stack>
                    <Box>
                      <Typography variant="h3" sx={{ fontSize: "1.12rem" }}>
                        {slide.title || "ไม่มีชื่อสไลด์"}
                      </Typography>
                      {slide.subtitle && (
                        <Typography color="text.secondary" className="content-summary" sx={{ mt: 0.75 }}>
                          {slide.subtitle}
                        </Typography>
                      )}
                    </Box>
                    {dateRangeLabel && (
                      <Typography color="text.secondary" variant="body2">
                        {dateRangeLabel}
                      </Typography>
                    )}
                    <Typography color="text.secondary" variant="body2" sx={{ wordBreak: "break-word" }}>
                      {slide.href || "/"}
                    </Typography>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton aria-label="แก้ไขสไลด์หน้าแรก" onClick={() => handleEditSlide(slide)} size="small">
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        aria-label="ลบสไลด์หน้าแรก"
                        color="error"
                        disabled={deleteCarouselMutation.isPending}
                        onClick={() => void handleDeleteCarouselSlide(slide)}
                        size="small"
                      >
                        <DeleteOutlineOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>{isCreating ? "เพิ่มสไลด์หน้าแรก" : "แก้ไขสไลด์หน้าแรก"}</DialogTitle>
        <DialogContent dividers>
          {editingSlide && (
            <Grid container spacing={2.5} sx={{ pt: 1 }}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editingSlide.enabled}
                        onChange={(event) => updateEditingSlide("enabled", event.target.checked)}
                      />
                    }
                    label="เปิดใช้งาน"
                  />
                  <TextField
                    label="ชื่อสไลด์"
                    value={editingSlide.title}
                    onChange={(event) => updateEditingSlide("title", event.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="คำอธิบาย"
                    value={editingSlide.subtitle}
                    onChange={(event) => updateEditingSlide("subtitle", event.target.value)}
                    minRows={3}
                    multiline
                    fullWidth
                  />
                  <TextField
                    label="ป้ายกำกับ"
                    value={editingSlide.chip}
                    onChange={(event) => updateEditingSlide("chip", event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="รูปภาพ URL"
                    value={editingSlide.imageUrl}
                    onChange={(event) => updateEditingSlide("imageUrl", event.target.value)}
                    helperText="กรอก URL รูปภาพเอง หรือเลือกจากคลังสื่อด้านล่าง"
                    required
                    fullWidth
                  />
                  <Box
                    sx={{
                      p: 1.5,
                      border: "1px solid rgba(31, 90, 44, 0.14)",
                      borderRadius: 2,
                      bgcolor: "rgba(255, 255, 255, 0.78)"
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ImageOutlinedIcon color="primary" fontSize="small" />
                        <Box>
                          <Typography fontWeight={900} variant="body2">
                            เลือกจากคลังสื่อ
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            เลือกภาพที่อัปโหลดไว้ในคลังสื่อเพื่อใช้เป็นภาพสไลด์ หรือกรอก URL รูปภาพเองด้านบน
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider />
                      {imageMediaAssets.length === 0 ? (
                        <Alert severity="info">
                          ยังไม่มีรูปภาพในคลังสื่อ กรุณาอัปโหลดรูปภาพในเมนูสื่อ หรือกรอก URL รูปภาพเอง
                        </Alert>
                      ) : (
                        <Box sx={{ maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
                          <Grid container spacing={1.25}>
                            {imageMediaAssets.map((asset) => {
                              const imageUrl = getMediaImageUrl(asset);
                              const selected = isSelectedCarouselImage(editingSlide, asset);

                              return (
                                <Grid key={asset.id} size={{ xs: 12, sm: 6 }}>
                                  <Card
                                    variant="outlined"
                                    sx={{
                                      height: "100%",
                                      borderColor: selected ? "primary.main" : "rgba(31, 90, 44, 0.14)",
                                      boxShadow: selected ? "0 0 0 1px rgba(31, 90, 44, 0.35)" : "none"
                                    }}
                                  >
                                    <Box
                                      component="img"
                                      src={imageUrl}
                                      alt={asset.name}
                                      sx={{
                                        width: "100%",
                                        height: 110,
                                        display: "block",
                                        objectFit: "cover",
                                        bgcolor: "primary.light"
                                      }}
                                    />
                                    <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
                                      <Stack spacing={1}>
                                        <Stack direction="row" spacing={0.75} alignItems="flex-start">
                                          <Typography
                                            variant="body2"
                                            fontWeight={800}
                                            sx={{
                                              flex: 1,
                                              minWidth: 0,
                                              display: "-webkit-box",
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: "vertical",
                                              overflow: "hidden"
                                            }}
                                          >
                                            {asset.name}
                                          </Typography>
                                          {(asset.driveUrl || imageUrl) && (
                                            <Tooltip title="เปิดรูปภาพ">
                                              <IconButton
                                                aria-label={`เปิดรูปภาพ ${asset.name}`}
                                                component="a"
                                                href={normalizeSafeHref(asset.driveUrl || imageUrl)}
                                                target="_blank"
                                                rel="noreferrer"
                                                size="small"
                                              >
                                                <OpenInNewOutlinedIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                        </Stack>
                                        {selected ? (
                                          <Chip
                                            icon={<CheckCircleOutlineOutlinedIcon />}
                                            label="กำลังใช้ภาพนี้"
                                            color="primary"
                                            size="small"
                                            sx={{ alignSelf: "flex-start", fontWeight: 800 }}
                                          />
                                        ) : (
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => handleSelectMediaImage(asset)}
                                          >
                                            เลือกภาพนี้
                                          </Button>
                                        )}
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                  <TextField
                    label="คำอธิบายรูปภาพ alt"
                    value={editingSlide.imageAlt}
                    onChange={(event) => updateEditingSlide("imageAlt", event.target.value)}
                    fullWidth
                  />
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="ข้อความปุ่ม"
                        value={editingSlide.buttonLabel}
                        onChange={(event) => updateEditingSlide("buttonLabel", event.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="ลิงก์ปลายทาง"
                        value={editingSlide.href}
                        onChange={(event) => updateEditingSlide("href", event.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label="ลำดับ"
                        type="number"
                        value={editingSlide.order}
                        onChange={(event) => updateEditingSlide("order", Number(event.target.value))}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label="เริ่มแสดง"
                        type="datetime-local"
                        value={toLocalDateTimeInputValue(editingSlide.startAt)}
                        onChange={(event) =>
                          updateEditingSlide("startAt", fromLocalDateTimeInputValue(event.target.value))
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label="สิ้นสุดการแสดง"
                        type="datetime-local"
                        value={toLocalDateTimeInputValue(editingSlide.endAt)}
                        onChange={(event) =>
                          updateEditingSlide("endAt", fromLocalDateTimeInputValue(event.target.value))
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Card sx={{ overflow: "hidden" }}>
                  <Box
                    sx={{
                      minHeight: 220,
                      display: "flex",
                      alignItems: "flex-end",
                      p: 2.2,
                      color: "white",
                      bgcolor: "primary.dark",
                      backgroundImage: editingSlide.imageUrl
                        ? `linear-gradient(105deg, rgba(31, 90, 44, 0.9), rgba(0, 0, 0, 0.3)), url(${JSON.stringify(
                            editingSlide.imageUrl
                          )})`
                        : undefined,
                      backgroundPosition: "center",
                      backgroundSize: "cover"
                    }}
                  >
                    <Stack spacing={1.1} sx={{ maxWidth: 420 }}>
                      <Chip
                        label={editingSlide.chip || "ประชาสัมพันธ์"}
                        color="secondary"
                        sx={{ alignSelf: "flex-start", color: "primary.dark", fontWeight: 800 }}
                      />
                      <Typography variant="h3" sx={{ fontSize: "1.35rem", color: "inherit" }}>
                        {editingSlide.title || "ชื่อสไลด์หน้าแรก"}
                      </Typography>
                      <Typography sx={{ color: "rgba(255, 255, 255, 0.86)" }}>
                        {editingSlide.subtitle || "คำอธิบายสั้นสำหรับสไลด์หน้าแรก"}
                      </Typography>
                      <Button
                        component="a"
                        href={normalizeSafeHref(editingSlide.href || "/")}
                        variant="contained"
                        color="secondary"
                        size="small"
                        sx={{ alignSelf: "flex-start", color: "primary.dark", fontWeight: 800 }}
                      >
                        {editingSlide.buttonLabel || "อ่านต่อ"}
                      </Button>
                    </Stack>
                  </Box>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={handleCloseDialog} disabled={saveCarouselMutation.isPending}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={saveCarouselMutation.isPending}
            onClick={() => void handleSaveCarouselSlide()}
          >
            {saveCarouselMutation.isPending ? "กำลังบันทึก" : "บันทึกสไลด์หน้าแรก"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
