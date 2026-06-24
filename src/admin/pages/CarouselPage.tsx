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
import { useAuth } from "../../context/authSessionContext";
import { deleteCarouselSlideFromApi, saveCarouselSlideToApi } from "../../features/cms-carousel";
import { getAdminCmsSnapshot } from "../../features/cms-dashboard";
import { saveHomepageSettingsToApi } from "../../features/cms-settings";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";
import { CarouselSlide, HomepageCarouselSettings, MediaAsset } from "../../types";
import { formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { appSwal } from "../../utils/swal";
import {
  CAROUSEL_FALLBACK_TITLE,
  getCarouselSlideDisplayTitle,
  getCarouselSlideValidationMessage,
  normalizeCarouselAutoplayInterval
} from "../utils/carousel";
import { ADMIN_READ_ONLY_NOTICE, canManageContent } from "../utils/rbac";

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

function createCarouselDraft(order: number): CarouselSlide {
  const now = new Date().toISOString();

  return {
    id: "",
    title: "",
    subtitle: "",
    chip: "",
    imageUrl: "",
    imageAlt: "",
    buttonLabel: "",
    href: "",
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
    chip: slide.chip.trim(),
    imageUrl: slide.imageUrl.trim(),
    imageAlt: slide.imageAlt.trim(),
    buttonLabel: slide.buttonLabel.trim(),
    href: slide.href.trim(),
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
  const { session } = useAuth();
  const canManage = canManageContent(session?.user);
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
  const homepageSettings = useMemo(
    () => normalizeHomepageSettings(adminSnapshotQuery.data?.homepageSettings),
    [adminSnapshotQuery.data?.homepageSettings]
  );
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);
  const [carouselSettingsDraft, setCarouselSettingsDraft] = useState<HomepageCarouselSettings | null>(null);
  const carouselSettings = carouselSettingsDraft ?? homepageSettings.carousel;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const saveCarouselMutation = useMutation({
    mutationFn: saveCarouselSlideToApi
  });
  const deleteCarouselMutation = useMutation({
    mutationFn: deleteCarouselSlideFromApi
  });
  const saveHomepageSettingsMutation = useMutation({
    mutationFn: saveHomepageSettingsToApi
  });

  function updateEditingSlide<K extends keyof CarouselSlide>(key: K, value: CarouselSlide[K]) {
    if (!canManage) {
      return;
    }

    setEditingSlide((current) =>
      current
        ? {
            ...current,
            [key]: value
          }
        : current
    );
  }

  function updateCarouselSettings<K extends keyof HomepageCarouselSettings>(
    key: K,
    value: HomepageCarouselSettings[K]
  ) {
    if (!canManage) {
      return;
    }

    setCarouselSettingsDraft((current) => {
      const baseSettings = current ?? homepageSettings.carousel;

      return {
        ...baseSettings,
        [key]: key === "autoplayIntervalSeconds" ? normalizeCarouselAutoplayInterval(value as number) : value
      };
    });
  }

  function handleAddSlide() {
    if (!canManage) {
      return;
    }

    setEditingSlide(createCarouselDraft(slides.length + 1));
    setIsCreating(true);
    setDialogOpen(true);
  }

  function handleEditSlide(slide: CarouselSlide) {
    if (!canManage) {
      return;
    }

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
    if (!canManage) {
      return;
    }

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
    await invalidatePublicCmsData(queryClient);
  }

  async function handleSaveCarouselSettings() {
    if (!canManage) {
      return;
    }

    try {
      const nextSettings = normalizeHomepageSettings({
        ...homepageSettings,
        carousel: carouselSettings
      });
      const saved = await saveHomepageSettingsMutation.mutateAsync(nextSettings);
      setCarouselSettingsDraft(normalizeHomepageSettings(saved).carousel);
      await invalidateCarouselData();
      await appSwal.fire({
        icon: "success",
        title: "บันทึกการตั้งค่าสไลด์หน้าแรกแล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกการตั้งค่าสไลด์หน้าแรกได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  async function handleSaveCarouselSlide() {
    if (!canManage) {
      return;
    }

    if (!editingSlide) {
      return;
    }

    const nextSlide = normalizeCarouselDraft(editingSlide);
    const validationMessage = getCarouselSlideValidationMessage(nextSlide);

    if (validationMessage) {
      await appSwal.fire({
        icon: "warning",
        title: validationMessage.title,
        text: validationMessage.text,
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
    if (!canManage) {
      return;
    }

    const result = await appSwal.fire({
      icon: "warning",
      title: "ลบสไลด์หน้าแรก?",
      text: getCarouselSlideDisplayTitle(slide),
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
          canManage ? (
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleAddSlide}>
              เพิ่มสไลด์
            </Button>
          ) : undefined
        }
      />
      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h3" sx={{ fontSize: "1.12rem" }}>
                  การเล่นสไลด์อัตโนมัติ
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  ตั้งค่าการเลื่อนภาพอัตโนมัติสำหรับสไลด์หน้าแรก
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<SaveOutlinedIcon />}
                disabled={!canManage || saveHomepageSettingsMutation.isPending || adminSnapshotQuery.isLoading}
                onClick={() => void handleSaveCarouselSettings()}
              >
                {saveHomepageSettingsMutation.isPending ? "กำลังบันทึก" : "บันทึกการตั้งค่า"}
              </Button>
            </Stack>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={carouselSettings.autoplayEnabled}
                      onChange={(event) => updateCarouselSettings("autoplayEnabled", event.target.checked)}
                      disabled={!canManage}
                    />
                  }
                  label="เปิดเล่นสไลด์อัตโนมัติ"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="ระยะเวลาเปลี่ยนภาพ (วินาที)"
                  type="number"
                  value={carouselSettings.autoplayIntervalSeconds}
                  onChange={(event) => updateCarouselSettings("autoplayIntervalSeconds", Number(event.target.value))}
                  helperText="กำหนดได้ตั้งแต่ 3 ถึง 30 วินาที"
                  inputProps={{ min: 3, max: 30 }}
                  size="small"
                  disabled={!canManage}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

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
              {canManage && (
                <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleAddSlide}>
                  เพิ่มสไลด์
                </Button>
              )}
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
                        {getCarouselSlideDisplayTitle(slide)}
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
                    {slide.href && (
                      <Typography color="text.secondary" variant="body2" sx={{ wordBreak: "break-word" }}>
                        {slide.href}
                      </Typography>
                    )}
                    {canManage && (
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
                    )}
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
                        disabled={!canManage}
                      />
                    }
                    label="เปิดใช้งาน"
                  />
                  <TextField
                    label="ชื่อสไลด์ (ไม่บังคับ)"
                    value={editingSlide.title}
                    onChange={(event) => updateEditingSlide("title", event.target.value)}
                    helperText="ใช้เป็นคำอธิบายภายในและข้อความสำรองสำหรับรูปภาพ"
                    disabled={!canManage}
                    fullWidth
                  />
                  <TextField
                    label="คำอธิบาย (ไม่บังคับ)"
                    value={editingSlide.subtitle}
                    onChange={(event) => updateEditingSlide("subtitle", event.target.value)}
                    minRows={3}
                    multiline
                    disabled={!canManage}
                    fullWidth
                  />
                  <TextField
                    label="ป้ายกำกับเดิม (ไม่บังคับ)"
                    value={editingSlide.chip}
                    onChange={(event) => updateEditingSlide("chip", event.target.value)}
                    disabled={!canManage}
                    fullWidth
                  />
                  <TextField
                    label="รูปภาพ URL"
                    value={editingSlide.imageUrl}
                    onChange={(event) => updateEditingSlide("imageUrl", event.target.value)}
                    helperText="กรอก URL รูปภาพเอง หรือเลือกจากคลังสื่อด้านล่าง"
                    required
                    disabled={!canManage}
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
                                            disabled={!canManage}
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
                    label="คำอธิบายรูปภาพ alt (แนะนำ)"
                    value={editingSlide.imageAlt}
                    onChange={(event) => updateEditingSlide("imageAlt", event.target.value)}
                    helperText="ถ้าเว้นว่าง ระบบจะใช้ชื่อสไลด์ หรือข้อความสำรองสำหรับผู้อ่านหน้าจอ"
                    disabled={!canManage}
                    fullWidth
                  />
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="ข้อความปุ่มเดิม (ไม่บังคับ)"
                        value={editingSlide.buttonLabel}
                        onChange={(event) => updateEditingSlide("buttonLabel", event.target.value)}
                        disabled={!canManage}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="ลิงก์ปลายทางเดิม (ไม่บังคับ)"
                        value={editingSlide.href}
                        onChange={(event) => updateEditingSlide("href", event.target.value)}
                        disabled={!canManage}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label="ลำดับ"
                        type="number"
                        value={editingSlide.order}
                        onChange={(event) => updateEditingSlide("order", Number(event.target.value))}
                        disabled={!canManage}
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
                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 60 } }}
                        disabled={!canManage}
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
                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 60 } }}
                        disabled={!canManage}
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
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "primary.dark",
                      overflow: "hidden"
                    }}
                  >
                    {editingSlide.imageUrl ? (
                      <Box
                        component="img"
                        src={editingSlide.imageUrl}
                        alt={editingSlide.imageAlt || editingSlide.title || CAROUSEL_FALLBACK_TITLE}
                        sx={{
                          width: "100%",
                          minHeight: 220,
                          height: "100%",
                          display: "block",
                          objectFit: "cover",
                          objectPosition: "center center"
                        }}
                      />
                    ) : (
                      <Typography color="white" fontWeight={800}>
                        ยังไม่มีรูปภาพ
                      </Typography>
                    )}
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
            disabled={!canManage || saveCarouselMutation.isPending}
            onClick={() => void handleSaveCarouselSlide()}
          >
            {saveCarouselMutation.isPending ? "กำลังบันทึก" : "บันทึกสไลด์หน้าแรก"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
