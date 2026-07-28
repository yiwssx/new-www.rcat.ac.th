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
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { designTokens } from "../../design-system/tokens";
import { staticSurfaceSx } from "../../design-system/componentStyles";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ArrowDownwardOutlinedIcon from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowUpwardOutlinedIcon from "@mui/icons-material/ArrowUpwardOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SwapVertOutlinedIcon from "@mui/icons-material/SwapVertOutlined";
import ViewCarouselOutlinedIcon from "@mui/icons-material/ViewCarouselOutlined";
import AdminPagination from "../components/AdminPagination";
import CarouselGlobalSettingsEditor from "../components/CarouselGlobalSettingsEditor";
import {
  CarouselSlidePresentationFields,
  CarouselSlidePresentationPreview,
  type CarouselMediaTarget
} from "../components/CarouselSlidePresentationEditor";
import PageHeader from "../components/PageHeader";
import CarouselImageStage from "../../shared/components/CarouselImageStage";
import { useAuth } from "../../context/authSessionContext";
import {
  deleteCarouselSlideFromApi,
  normalizeCarouselSlide,
  saveCarouselSlideToApi
} from "../../features/cms-carousel";
import {
  ADMIN_MEDIA_PAGE_SIZE_OPTIONS,
  ADMIN_PAGE_SIZE_OPTIONS,
  adminCarouselOrderQueryOptions,
  adminListQueryKeys,
  adminMediaListQueryOptions,
  getAdminCarouselList,
  getAdminPageAfterDelete,
  invalidateAdminListQueries,
  saveAdminCarouselOrder,
  useAdminCarouselListQuery,
  useAdminListUrlState,
  useDebouncedValue,
  type AdminCarouselOrderItem
} from "../../features/admin-pagination";
import { getHomepageSettingsFromApi, saveHomepageSettingsToApi } from "../../features/cms-settings";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../../utils/calendar";
import { CarouselSlide, HomepageCarouselSettings, MediaAsset } from "../../types";
import { formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import {
  areHomepageCarouselSettingsEqual,
  CAROUSEL_FALLBACK_TITLE,
  getCarouselSlideDisplayTitle,
  getCarouselSlideValidationMessage,
  normalizeCarouselAutoplayInterval
} from "../utils/carousel";
import { ADMIN_READ_ONLY_NOTICE, canManageCarousel } from "../utils/rbac";

function getMediaImageUrl(asset: MediaAsset) {
  return asset.previewUrl || asset.driveUrl || asset.embedUrl || "";
}

function isSelectedCarouselImage(slide: CarouselSlide, asset: MediaAsset, target: CarouselMediaTarget) {
  const selectedUrl = target === "mobile" ? slide.mobileImageUrl : slide.imageUrl;
  return Boolean(selectedUrl && selectedUrl === getMediaImageUrl(asset));
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
    updatedAt: now,
    imageFit: "fit-blur",
    focalPointX: 50,
    focalPointY: 50,
    mobileImageUrl: "",
    backgroundColor: "",
    openInNewTab: false
  };
}

function normalizeCarouselDraft(slide: CarouselSlide): CarouselSlide {
  const normalizedSlide = normalizeCarouselSlide(slide);
  const title = normalizedSlide.title.trim();
  const order = Number(slide.order);

  return {
    ...normalizedSlide,
    title,
    subtitle: normalizedSlide.subtitle.trim(),
    chip: normalizedSlide.chip.trim(),
    imageUrl: normalizedSlide.imageUrl.trim(),
    imageAlt: normalizedSlide.imageAlt.trim(),
    buttonLabel: normalizedSlide.buttonLabel.trim(),
    href: normalizedSlide.href.trim(),
    enabled: Boolean(normalizedSlide.enabled),
    order: Number.isFinite(order) ? order : 0,
    startAt: normalizedSlide.startAt || "",
    endAt: normalizedSlide.endAt || ""
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

const carouselListUrlOptions = {
  defaultPageSize: 25,
  pageSizeOptions: ADMIN_PAGE_SIZE_OPTIONS,
  defaultSortBy: "order",
  defaultSortDirection: "asc",
  filterDefaults: { enabled: "all" }
} as const;

function normalizeCarouselOrder(items: AdminCarouselOrderItem[]) {
  return [...items]
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title, "th"))
    .map((item, index) => ({ ...item, order: index + 1 }));
}

function moveCarouselOrder(items: AdminCarouselOrderItem[], id: string, direction: -1 | 1) {
  const index = items.findIndex((item) => item.id === id);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(index, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(nextIndex, 0, movedItem);
  return nextItems.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
}

function carouselOrdersEqual(left: AdminCarouselOrderItem[], right: AdminCarouselOrderItem[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return other?.id === item.id && other.order === item.order && other.enabled === item.enabled;
    })
  );
}

export default function CarouselPage() {
  const queryClient = useQueryClient();
  const { capabilities } = useAuth();
  const canManage = canManageCarousel(capabilities);
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
    setFilter,
    setSort
  } = useAdminListUrlState<"enabled">(carouselListUrlOptions);
  const debouncedSearch = useDebouncedValue(q, 300);
  const enabledFilter = filters.enabled;
  const adminListQuery = useAdminCarouselListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    enabled: enabledFilter === "all" ? "all" : enabledFilter === "true",
    sortBy,
    sortDirection
  });
  const listTransitioning = adminListQuery.isPlaceholderData || debouncedSearch !== q;
  const slides = adminListQuery.data?.items ?? [];
  useEffect(() => {
    const responsePage = adminListQuery.data?.pagination.page;

    if (!adminListQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState({ page: responsePage }, { replace: true });
    }
  }, [adminListQuery.data?.pagination.page, adminListQuery.isPlaceholderData, page, setListState]);
  const homepageSettingsQuery = useQuery({
    queryKey: ["admin-settings", "homepage"],
    queryFn: async () => normalizeHomepageSettings(await getHomepageSettingsFromApi())
  });
  const homepageSettings = homepageSettingsQuery.data ?? normalizeHomepageSettings();
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);
  const [carouselSettingsDraft, setCarouselSettingsDraft] = useState<HomepageCarouselSettings | null>(null);
  const carouselSettings = carouselSettingsDraft ?? homepageSettings.carousel;
  const carouselSettingsDirty = !areHomepageCarouselSettingsEqual(carouselSettings, homepageSettings.carousel);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [orderingMode, setOrderingMode] = useState(false);
  const orderQuery = useQuery({
    ...adminCarouselOrderQueryOptions(),
    enabled: orderingMode
  });
  const serverOrder = useMemo(() => normalizeCarouselOrder(orderQuery.data ?? []), [orderQuery.data]);
  const [orderDraft, setOrderDraft] = useState<AdminCarouselOrderItem[] | null>(null);
  const orderedSlides = orderDraft ?? serverOrder;
  const orderDirty = orderDraft !== null && !carouselOrdersEqual(orderDraft, serverOrder);
  const [mediaSearch, setMediaSearch] = useState("");
  const debouncedMediaSearch = useDebouncedValue(mediaSearch, 300);
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaPageSize, setMediaPageSize] = useState(24);
  const [mediaTarget, setMediaTarget] = useState<CarouselMediaTarget>("desktop");
  const mediaQuery = useQuery({
    ...adminMediaListQueryOptions({
      page: mediaPage,
      pageSize: mediaPageSize,
      q: debouncedMediaSearch,
      type: "image",
      sortBy: "updatedAt",
      sortDirection: "desc"
    }),
    enabled: dialogOpen
  });
  const mediaTransitioning = mediaQuery.isPlaceholderData || debouncedMediaSearch !== mediaSearch;
  const imageMediaAssets = mediaTransitioning ? [] : (mediaQuery.data?.items ?? []);

  const saveCarouselMutation = useMutation({
    mutationFn: saveCarouselSlideToApi
  });
  const deleteCarouselMutation = useMutation({
    mutationFn: deleteCarouselSlideFromApi
  });
  const saveHomepageSettingsMutation = useMutation({
    mutationFn: saveHomepageSettingsToApi
  });
  const saveOrderMutation = useMutation({
    mutationFn: saveAdminCarouselOrder
  });

  function updateEditingSlide<K extends keyof CarouselSlide>(key: K, value: CarouselSlide[K]) {
    if (!canManage || listTransitioning) {
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

  async function handleAddSlide() {
    if (!canManage || listTransitioning) {
      return;
    }

    try {
      const response = await getAdminCarouselList({ page: 1, pageSize: 1, sortBy: "order", sortDirection: "desc" });
      setEditingSlide(createCarouselDraft((response.items[0]?.order ?? 0) + 1));
      setMediaSearch("");
      setMediaPage(1);
      setMediaTarget("desktop");
      setIsCreating(true);
      setDialogOpen(true);
    } catch (error) {
      await showErrorResult("ไม่สามารถเตรียมสไลด์ใหม่ได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function handleEditSlide(slide: CarouselSlide) {
    if (!canManage || listTransitioning) {
      return;
    }

    setEditingSlide(
      normalizeCarouselSlide({
        ...slide,
        startAt: slide.startAt || "",
        endAt: slide.endAt || ""
      })
    );
    setMediaSearch("");
    setMediaPage(1);
    setMediaTarget("desktop");
    setIsCreating(false);
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    if (saveCarouselMutation.isPending) {
      return;
    }

    setDialogOpen(false);
    setEditingSlide(null);
    setMediaTarget("desktop");
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

    setEditingSlide((current) => {
      if (!current) {
        return current;
      }

      if (mediaTarget === "mobile") {
        return {
          ...current,
          mobileImageUrl: imageUrl
        };
      }

      return {
        ...current,
        imageUrl,
        imageAlt: current.imageAlt.trim() || asset.name || current.title
      };
    });
  }

  async function invalidateCarouselData() {
    await Promise.all([
      invalidateAdminListQueries(queryClient, "carousel"),
      queryClient.invalidateQueries({ queryKey: adminListQueryKeys.order("carousel") }),
      invalidatePublicCmsData(queryClient)
    ]);
  }

  async function handleSaveCarouselSettings() {
    if (!canManage || !carouselSettingsDirty || saveHomepageSettingsMutation.isPending) {
      return;
    }

    showBlockingLoading("กำลังบันทึกการตั้งค่าสไลด์หน้าแรก");

    try {
      const nextSettings = normalizeHomepageSettings({
        ...homepageSettings,
        carousel: carouselSettings
      });
      const saved = normalizeHomepageSettings(await saveHomepageSettingsMutation.mutateAsync(nextSettings));

      setCarouselSettingsDraft(null);
      queryClient.setQueryData(["admin-settings", "homepage"], saved);
      await invalidatePublicCmsData(queryClient);
      await appSwal.close();
      await showSuccessResult("บันทึกการตั้งค่าสไลด์หน้าแรกแล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกการตั้งค่าสไลด์หน้าแรกได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function handleResetCarouselSettings() {
    if (!canManage || saveHomepageSettingsMutation.isPending) {
      return;
    }

    setCarouselSettingsDraft(null);
  }

  async function handleSaveCarouselSlide() {
    if (!canManage) {
      return;
    }

    if (!editingSlide) {
      return;
    }

    const validationMessage = getCarouselSlideValidationMessage(editingSlide);

    if (validationMessage) {
      await appSwal.fire({
        icon: "warning",
        title: validationMessage.title,
        text: validationMessage.text,
        confirmButtonText: "ตกลง"
      });
      return;
    }

    const nextSlide = normalizeCarouselDraft(editingSlide);

    showBlockingLoading("กำลังบันทึกสไลด์หน้าแรก");

    try {
      const saved = await saveCarouselMutation.mutateAsync(nextSlide);
      setEditingSlide(normalizeCarouselSlide(saved));
      handleCloseDialog();
      if (isCreating && sortBy === "updatedAt" && sortDirection === "desc" && page !== 1) {
        setPage(1);
      }
      await invalidateCarouselData();
      await appSwal.close();
      await showSuccessResult("บันทึกสไลด์หน้าแรกแล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกสไลด์หน้าแรกได้", error, "กรุณาลองอีกครั้ง");
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

    showBlockingLoading("กำลังลบสไลด์หน้าแรก");

    try {
      await deleteCarouselMutation.mutateAsync(slide.id);
      const nextPage = adminListQuery.data ? getAdminPageAfterDelete(adminListQuery.data.pagination) : page;

      if (nextPage !== page) {
        setPage(nextPage);
      }
      await invalidateCarouselData();
      await appSwal.close();
      await showSuccessResult("ลบสไลด์หน้าแรกแล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถลบสไลด์หน้าแรกได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function handleOpenOrdering() {
    if (!canManage) {
      return;
    }

    setOrderDraft(null);
    setOrderingMode(true);
  }

  function handleCancelOrdering() {
    if (saveOrderMutation.isPending) {
      return;
    }

    setOrderDraft(null);
    setOrderingMode(false);
  }

  function handleMoveOrder(item: AdminCarouselOrderItem, direction: -1 | 1) {
    if (!canManage || saveOrderMutation.isPending) {
      return;
    }

    setOrderDraft((current) => moveCarouselOrder(current ?? serverOrder, item.id, direction));
  }

  function handleToggleOrderEnabled(item: AdminCarouselOrderItem, enabled: boolean) {
    if (!canManage || saveOrderMutation.isPending) {
      return;
    }

    setOrderDraft((current) =>
      (current ?? serverOrder).map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, enabled } : currentItem
      )
    );
  }

  async function handleSaveOrder() {
    if (!canManage || !orderDirty || saveOrderMutation.isPending) {
      return;
    }

    showBlockingLoading("กำลังบันทึกลำดับสไลด์หน้าแรก");

    try {
      const saved = await saveOrderMutation.mutateAsync(orderedSlides);
      queryClient.setQueryData(adminListQueryKeys.order("carousel"), saved);
      setOrderDraft(null);
      await Promise.all([invalidateAdminListQueries(queryClient, "carousel"), invalidatePublicCmsData(queryClient)]);
      await appSwal.close();
      await showSuccessResult("บันทึกลำดับสไลด์หน้าแรกแล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกลำดับสไลด์หน้าแรกได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  return (
    <Box>
      <PageHeader
        title="สไลด์หน้าแรก"
        description="จัดการสไลด์ประชาสัมพันธ์ที่แสดงใน Carousel หน้าแรก"
        action={
          canManage ? (
            orderingMode ? (
              <Stack direction="row" spacing={1}>
                <Button color="inherit" onClick={handleCancelOrdering} disabled={saveOrderMutation.isPending}>
                  ยกเลิกจัดลำดับ
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setOrderDraft(null)}
                  disabled={!orderDirty || saveOrderMutation.isPending}
                >
                  คืนค่า
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  onClick={() => void handleSaveOrder()}
                  disabled={!orderDirty || saveOrderMutation.isPending}
                >
                  {saveOrderMutation.isPending ? "กำลังบันทึก" : "บันทึกลำดับ"}
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<SwapVertOutlinedIcon />}
                  onClick={handleOpenOrdering}
                  disabled={listTransitioning}
                >
                  จัดลำดับ
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddOutlinedIcon />}
                  onClick={() => void handleAddSlide()}
                  disabled={listTransitioning}
                >
                  เพิ่มสไลด์
                </Button>
              </Stack>
            )
          ) : undefined
        }
      />
      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}

      <CarouselGlobalSettingsEditor
        settings={carouselSettings}
        disabled={!canManage || homepageSettingsQuery.isLoading}
        loading={homepageSettingsQuery.isLoading}
        saving={saveHomepageSettingsMutation.isPending}
        dirty={carouselSettingsDirty}
        onChange={updateCarouselSettings}
        onReset={handleResetCarouselSettings}
        onSave={() => void handleSaveCarouselSettings()}
      />

      {homepageSettingsQuery.isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {homepageSettingsQuery.error instanceof Error
            ? homepageSettingsQuery.error.message
            : "ไม่สามารถโหลดการตั้งค่าสไลด์หน้าแรกได้"}
        </Alert>
      )}

      {orderingMode ? (
        <Card>
          {(orderQuery.isLoading || orderQuery.isFetching) && <LinearProgress />}
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.15rem" }}>
                  จัดลำดับสไลด์ทั้งหมด
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  โหลดเฉพาะข้อมูลลำดับแบบย่อ ปรับตำแหน่งและสถานะ แล้วกดบันทึกลำดับ
                </Typography>
              </Box>
              {orderQuery.isError && (
                <Alert severity="error">
                  {orderQuery.error instanceof Error ? orderQuery.error.message : "ไม่สามารถโหลดลำดับสไลด์ได้"}
                </Alert>
              )}
              {!orderQuery.isLoading && !orderedSlides.length && !orderQuery.isError && (
                <Typography color="text.secondary">ยังไม่มีสไลด์ให้จัดลำดับ</Typography>
              )}
              {orderedSlides.map((slide, index) => (
                <Stack
                  key={slide.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}
                >
                  <Chip label={`ลำดับ ${index + 1}`} size="small" sx={{ alignSelf: "flex-start" }} />
                  <Typography fontWeight={800} sx={{ flex: 1, minWidth: 0 }}>
                    {slide.title || CAROUSEL_FALLBACK_TITLE}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={slide.enabled}
                        onChange={(event) => handleToggleOrderEnabled(slide, event.target.checked)}
                        disabled={saveOrderMutation.isPending}
                      />
                    }
                    label="เปิดใช้งาน"
                  />
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      aria-label={`เลื่อนขึ้น ${slide.title || CAROUSEL_FALLBACK_TITLE}`}
                      onClick={() => handleMoveOrder(slide, -1)}
                      disabled={index === 0 || saveOrderMutation.isPending}
                    >
                      <ArrowUpwardOutlinedIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`เลื่อนลง ${slide.title || CAROUSEL_FALLBACK_TITLE}`}
                      onClick={() => handleMoveOrder(slide, 1)}
                      disabled={index === orderedSlides.length - 1 || saveOrderMutation.isPending}
                    >
                      <ArrowDownwardOutlinedIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            {(adminListQuery.isFetching || debouncedSearch !== q) && <LinearProgress />}
            <CardContent>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="ค้นหาสไลด์"
                    value={q}
                    onChange={(event) => setSearch(event.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="carousel-enabled-filter-label">สถานะ</InputLabel>
                    <Select
                      labelId="carousel-enabled-filter-label"
                      label="สถานะ"
                      value={enabledFilter}
                      onChange={(event) => setFilter("enabled", event.target.value)}
                    >
                      <MenuItem value="all">ทั้งหมด</MenuItem>
                      <MenuItem value="true">เปิดใช้งาน</MenuItem>
                      <MenuItem value="false">ปิดใช้งาน</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="carousel-sort-label">เรียงตาม</InputLabel>
                    <Select
                      labelId="carousel-sort-label"
                      label="เรียงตาม"
                      value={`${sortBy ?? "order"}:${sortDirection ?? "asc"}`}
                      onChange={(event) => {
                        const [nextSortBy, nextDirection] = event.target.value.split(":");
                        setSort(nextSortBy || "order", nextDirection === "desc" ? "desc" : "asc");
                      }}
                    >
                      <MenuItem value="order:asc">ลำดับน้อยไปมาก</MenuItem>
                      <MenuItem value="updatedAt:desc">แก้ไขล่าสุด</MenuItem>
                      <MenuItem value="title:asc">ชื่อ ก–ฮ</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {adminListQuery.isError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {adminListQuery.error instanceof Error ? adminListQuery.error.message : "ไม่สามารถโหลดสไลด์หน้าแรกได้"}
            </Alert>
          )}

          {!adminListQuery.isLoading && !listTransitioning && !slides.length && !adminListQuery.isError && (
            <Card>
              <CardContent>
                <Stack spacing={2} alignItems="flex-start">
                  <ViewCarouselOutlinedIcon color="primary" sx={{ fontSize: 44 }} />
                  <Box>
                    <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                      {q || enabledFilter !== "all" ? "ไม่พบสไลด์ที่ตรงกับเงื่อนไข" : "ยังไม่มีสไลด์หน้าแรก"}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                      เพิ่มสไลด์เพื่อแสดงภาพประชาสัมพันธ์ใน Carousel หน้าแรก
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Grid
            container
            spacing={2.5}
            aria-busy={listTransitioning}
            sx={{ opacity: listTransitioning ? 0.55 : 1, transition: "opacity 120ms ease" }}
          >
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
                      <CarouselImageStage
                        slide={slide}
                        alt={slide.imageAlt || slide.title || CAROUSEL_FALLBACK_TITLE}
                        loading="lazy"
                        sizes="(max-width: 900px) 100vw, 420px"
                        emptyLabel="ยังไม่มีรูปภาพ"
                        stageSx={{ height: 180 }}
                      />
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
                            <IconButton
                              aria-label={`แก้ไขสไลด์หน้าแรก ${getCarouselSlideDisplayTitle(slide)}`}
                              onClick={() => handleEditSlide(slide)}
                              disabled={listTransitioning}
                              size="small"
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              aria-label={`ลบสไลด์หน้าแรก ${getCarouselSlideDisplayTitle(slide)}`}
                              color="error"
                              disabled={listTransitioning || deleteCarouselMutation.isPending}
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

          {adminListQuery.data && (
            <AdminPagination
              pagination={adminListQuery.data.pagination}
              pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              disabled={listTransitioning}
              isFetching={adminListQuery.isFetching}
            />
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="lg">
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
                      ...staticSurfaceSx,
                      p: 1.5,
                      bgcolor: "background.paper"
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
                      <FormControl fullWidth size="small" disabled={!canManage}>
                        <InputLabel id="carousel-media-target-label">นำภาพไปใช้กับ</InputLabel>
                        <Select
                          labelId="carousel-media-target-label"
                          label="นำภาพไปใช้กับ"
                          value={mediaTarget}
                          onChange={(event) => setMediaTarget(event.target.value as CarouselMediaTarget)}
                        >
                          <MenuItem value="desktop">ภาพหลัก / เดสก์ท็อป</MenuItem>
                          <MenuItem value="mobile">ภาพสำหรับมือถือ</MenuItem>
                        </Select>
                      </FormControl>
                      <Divider />
                      <TextField
                        label="ค้นหารูปภาพในคลังสื่อ"
                        value={mediaSearch}
                        onChange={(event) => {
                          setMediaSearch(event.target.value);
                          setMediaPage(1);
                        }}
                        size="small"
                        fullWidth
                      />
                      {(mediaQuery.isFetching || debouncedMediaSearch !== mediaSearch) && <LinearProgress />}
                      {mediaQuery.isError && (
                        <Alert severity="error">
                          {mediaQuery.error instanceof Error
                            ? mediaQuery.error.message
                            : "ไม่สามารถโหลดรูปภาพจากคลังสื่อได้"}
                        </Alert>
                      )}
                      {!mediaQuery.isLoading && !mediaTransitioning && imageMediaAssets.length === 0 ? (
                        <Alert severity="info">
                          {mediaSearch
                            ? "ไม่พบรูปภาพที่ตรงกับคำค้นหา"
                            : "ยังไม่มีรูปภาพในคลังสื่อ กรุณาอัปโหลดรูปภาพในเมนูสื่อ หรือกรอก URL รูปภาพเอง"}
                        </Alert>
                      ) : (
                        <Box sx={{ maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
                          <Grid container spacing={1.25}>
                            {imageMediaAssets.map((asset) => {
                              const imageUrl = getMediaImageUrl(asset);
                              const selected = isSelectedCarouselImage(editingSlide, asset, mediaTarget);

                              return (
                                <Grid key={asset.id} size={{ xs: 12, sm: 6 }}>
                                  <Card
                                    variant="outlined"
                                    sx={{
                                      height: "100%",
                                      borderColor: selected ? "primary.main" : "divider",
                                      boxShadow: selected ? `0 0 0 1px ${designTokens.color.brandPrimary}` : "none"
                                    }}
                                  >
                                    <Box
                                      component="img"
                                      src={imageUrl}
                                      alt={asset.name}
                                      loading="lazy"
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
                                            label={
                                              mediaTarget === "mobile" ? "กำลังใช้เป็นภาพมือถือ" : "กำลังใช้เป็นภาพหลัก"
                                            }
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
                                            {mediaTarget === "mobile" ? "เลือกเป็นภาพมือถือ" : "เลือกเป็นภาพหลัก"}
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
                      {mediaQuery.data && !mediaTransitioning && (
                        <AdminPagination
                          pagination={mediaQuery.data.pagination}
                          pageSizeOptions={ADMIN_MEDIA_PAGE_SIZE_OPTIONS}
                          onPageChange={setMediaPage}
                          onPageSizeChange={(nextPageSize) => {
                            setMediaPageSize(nextPageSize);
                            setMediaPage(1);
                          }}
                          isFetching={mediaQuery.isFetching}
                        />
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
                  <CarouselSlidePresentationFields
                    slide={editingSlide}
                    disabled={!canManage}
                    onChange={updateEditingSlide}
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
                <CarouselSlidePresentationPreview slide={editingSlide} />
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
