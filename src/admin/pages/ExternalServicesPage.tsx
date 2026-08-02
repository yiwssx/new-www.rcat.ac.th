import { ReactNode, useEffect, useMemo, useState } from "react";
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
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { designTokens } from "../../design-system/tokens";
import ExternalServiceIcon from "../../design-system/icons/ExternalServiceIcon";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ArrowDownwardOutlinedIcon from "@mui/icons-material/ArrowDownwardOutlined";
import ArrowUpwardOutlinedIcon from "@mui/icons-material/ArrowUpwardOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SwapVertOutlinedIcon from "@mui/icons-material/SwapVertOutlined";
import AdminPagination from "../components/AdminPagination";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../../context/authSessionContext";
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  adminExternalServiceOrderQueryOptions,
  adminListQueryKeys,
  getAdminExternalServiceList,
  getAdminPageAfterDelete,
  invalidateAdminListQueries,
  saveAdminExternalServiceOrder,
  useAdminExternalServiceListQuery,
  useAdminListUrlState,
  useDebouncedValue,
  type AdminExternalServiceOrderItem
} from "../../features/admin-pagination";
import {
  deleteExternalServiceLinkFromApi,
  saveExternalServiceLinkToApi,
  type ExternalServiceLinkInput
} from "../../features/cms-external-services";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { ExternalServiceIconKey, ExternalServiceLink, ExternalServiceTone } from "../../types";
import { getExternalServiceToneStyle } from "../../utils/externalServiceTheme";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { ADMIN_READ_ONLY_NOTICE, canManageExternalServices } from "../utils/rbac";

interface ExternalServiceDraft extends ExternalServiceLink {
  draftKey: string;
}

const externalServiceToneOptions: Array<{ value: ExternalServiceTone; label: string }> = [
  { value: "student", label: "นักเรียน / นักศึกษา" },
  { value: "homeroom", label: "ดูแลช่วยเหลือผู้เรียน" },
  { value: "management", label: "บริหารจัดการ" },
  { value: "learning", label: "การเรียนรู้" },
  { value: "calendar", label: "ปฏิทิน / ทะเบียน" },
  { value: "check", label: "ตรวจสอบข้อมูล" },
  { value: "admission", label: "รับสมัครเรียน" },
  { value: "career", label: "อาชีพ / สถานประกอบการ" },
  { value: "general", label: "ทั่วไป" }
];

const externalServiceIconOptions: Array<{ value: ExternalServiceIconKey; label: string }> = [
  { value: "apps", label: "แอป / ระบบ" },
  { value: "calendar", label: "ปฏิทิน" },
  { value: "check", label: "ตรวจสอบ" },
  { value: "groups", label: "กลุ่ม / ผู้เรียน" },
  { value: "handshake", label: "ความร่วมมือ" },
  { value: "registration", label: "ลงทะเบียน" },
  { value: "book", label: "การเรียนรู้" },
  { value: "school", label: "สถานศึกษา" },
  { value: "link", label: "ลิงก์ทั่วไป" }
];

function createDraftKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `draft-${crypto.randomUUID()}`;
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeExternalServiceDraft(service: ExternalServiceLink | ExternalServiceDraft): ExternalServiceDraft {
  return {
    ...service,
    id: service.id || "",
    draftKey: "draftKey" in service ? service.draftKey : service.id || createDraftKey(),
    title: service.title.trim(),
    description: service.description.trim(),
    href: service.href.trim(),
    tone: service.tone || "general",
    iconKey: service.iconKey || "link",
    enabled: Boolean(service.enabled),
    order: Number.isFinite(Number(service.order)) ? Number(service.order) : 0,
    updatedAt: service.updatedAt || new Date().toISOString()
  };
}

function createExternalServiceDraft(order: number): ExternalServiceDraft {
  return {
    draftKey: createDraftKey(),
    id: "",
    title: "",
    description: "",
    href: "",
    tone: "general",
    iconKey: "link",
    enabled: true,
    order,
    updatedAt: new Date().toISOString()
  };
}

function toExternalServiceInput(service: ExternalServiceDraft): ExternalServiceLinkInput {
  return {
    id: service.id,
    title: service.title,
    description: service.description,
    href: service.href,
    tone: service.tone,
    iconKey: service.iconKey,
    enabled: service.enabled,
    order: service.order,
    updatedAt: service.updatedAt,
    revision: service.revision
  };
}

function getToneLabel(tone: ExternalServiceTone) {
  return externalServiceToneOptions.find((option) => option.value === tone)?.label ?? "ทั่วไป";
}

function getIconLabel(iconKey: ExternalServiceIconKey) {
  return externalServiceIconOptions.find((option) => option.value === iconKey)?.label ?? "ลิงก์ทั่วไป";
}

function getExternalServiceIcon(iconKey: ExternalServiceIconKey): ReactNode {
  return <ExternalServiceIcon iconKey={iconKey} />;
}

function isAllowedExternalServiceHref(href: string) {
  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(href);
}

function isExampleHref(href: string) {
  return href.toLowerCase().includes("example.com");
}

function getExternalServiceValidationMessage(service: ExternalServiceDraft) {
  if (!service.title.trim()) {
    return {
      title: "กรุณาระบุชื่อบริการ",
      text: undefined
    };
  }

  if (!service.href.trim()) {
    return {
      title: "กรุณาระบุ URL ของบริการ",
      text: undefined
    };
  }

  if (isExampleHref(service.href)) {
    return {
      title: "ไม่ควรใช้ลิงก์ตัวอย่าง",
      text: "กรุณาใช้ URL จริงของระบบบริการ"
    };
  }

  if (!isAllowedExternalServiceHref(service.href)) {
    return {
      title: "รูปแบบลิงก์ไม่ถูกต้อง",
      text: "ใช้ลิงก์ https://, http://, mailto:, tel: หรือ path ภายในที่ขึ้นต้นด้วย /"
    };
  }

  return null;
}

type ExternalServiceValidationMessage = NonNullable<ReturnType<typeof getExternalServiceValidationMessage>>;

const externalServiceListUrlOptions = {
  defaultPageSize: 25,
  pageSizeOptions: ADMIN_PAGE_SIZE_OPTIONS,
  defaultSortBy: "order",
  defaultSortDirection: "asc",
  filterDefaults: { enabled: "all", tone: "all" }
} as const;

function normalizeExternalServiceOrder(items: AdminExternalServiceOrderItem[]) {
  return [...items]
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title, "th"))
    .map((item, index) => ({ ...item, order: index + 1 }));
}

function moveExternalServiceOrder(items: AdminExternalServiceOrderItem[], id: string, direction: -1 | 1) {
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

function externalServiceOrdersEqual(left: AdminExternalServiceOrderItem[], right: AdminExternalServiceOrderItem[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return other?.id === item.id && other.order === item.order && other.enabled === item.enabled;
    })
  );
}

export default function ExternalServicesPage() {
  const queryClient = useQueryClient();
  const { capabilities } = useAuth();
  const canManage = canManageExternalServices(capabilities);
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
  } = useAdminListUrlState<"enabled" | "tone">(externalServiceListUrlOptions);
  const debouncedSearch = useDebouncedValue(q, 300);
  const enabledFilter = filters.enabled;
  const toneFilter = filters.tone as ExternalServiceTone | "all";
  const adminListQuery = useAdminExternalServiceListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    enabled: enabledFilter === "all" ? "all" : enabledFilter === "true",
    tone: toneFilter,
    sortBy,
    sortDirection
  });
  const listTransitioning = adminListQuery.isPlaceholderData || debouncedSearch !== q;
  const services = adminListQuery.data?.items ?? [];
  useEffect(() => {
    const responsePage = adminListQuery.data?.pagination.page;

    if (!adminListQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState({ page: responsePage }, { replace: true });
    }
  }, [adminListQuery.data?.pagination.page, adminListQuery.isPlaceholderData, page, setListState]);
  const [editingService, setEditingService] = useState<ExternalServiceDraft | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [orderingMode, setOrderingMode] = useState(false);
  const orderQuery = useQuery({
    ...adminExternalServiceOrderQueryOptions(),
    enabled: orderingMode
  });
  const serverOrder = useMemo(() => normalizeExternalServiceOrder(orderQuery.data ?? []), [orderQuery.data]);
  const [orderDraft, setOrderDraft] = useState<AdminExternalServiceOrderItem[] | null>(null);
  const orderedServices = orderDraft ?? serverOrder;
  const orderDirty = orderDraft !== null && !externalServiceOrdersEqual(orderDraft, serverOrder);

  const saveExternalServiceMutation = useMutation({
    mutationFn: saveExternalServiceLinkToApi
  });
  const deleteExternalServiceMutation = useMutation({
    mutationFn: deleteExternalServiceLinkFromApi
  });
  const saveOrderMutation = useMutation({
    mutationFn: saveAdminExternalServiceOrder
  });

  function updateEditingService<K extends keyof ExternalServiceDraft>(key: K, value: ExternalServiceDraft[K]) {
    if (!canManage || listTransitioning) {
      return;
    }

    setEditingService((current) =>
      current
        ? {
            ...current,
            [key]: value
          }
        : current
    );
  }

  async function handleAddService() {
    if (!canManage || listTransitioning) {
      return;
    }

    try {
      const response = await getAdminExternalServiceList({
        page: 1,
        pageSize: 1,
        sortBy: "order",
        sortDirection: "desc"
      });
      setEditingService(createExternalServiceDraft((response.items[0]?.order ?? 0) + 1));
      setIsCreating(true);
      setDialogOpen(true);
    } catch (error) {
      await showErrorResult("ไม่สามารถเตรียม E-Service ใหม่ได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function handleEditService(service: ExternalServiceLink) {
    if (!canManage || listTransitioning) {
      return;
    }

    setEditingService(normalizeExternalServiceDraft(service));
    setIsCreating(false);
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    if (saveExternalServiceMutation.isPending) {
      return;
    }

    setDialogOpen(false);
    setEditingService(null);
    setIsCreating(false);
  }

  async function showValidationWarning(validation: ExternalServiceValidationMessage) {
    await appSwal.fire({
      icon: "warning",
      title: validation.title,
      ...(validation.text ? { text: validation.text } : {}),
      confirmButtonText: "ตกลง"
    });
  }

  async function invalidateExternalServiceData() {
    await Promise.all([
      invalidateAdminListQueries(queryClient, "external-services"),
      queryClient.invalidateQueries({ queryKey: adminListQueryKeys.order("external-services") }),
      invalidatePublicCmsData(queryClient)
    ]);
  }

  async function handleSaveDialog() {
    if (!canManage || !editingService) {
      return;
    }

    const nextService = normalizeExternalServiceDraft(editingService);
    const validation = getExternalServiceValidationMessage(nextService);

    if (validation) {
      await showValidationWarning(validation);
      return;
    }

    showBlockingLoading(isCreating ? "กำลังเพิ่ม E-Service" : "กำลังบันทึก E-Service");

    try {
      await saveExternalServiceMutation.mutateAsync(toExternalServiceInput(nextService));
      handleCloseDialog();
      if (isCreating && sortBy === "updatedAt" && sortDirection === "desc" && page !== 1) {
        setPage(1);
      }
      await invalidateExternalServiceData();
      await appSwal.close();
      await showSuccessResult(isCreating ? "เพิ่ม E-Service แล้ว" : "บันทึก E-Service แล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึก E-Service ได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  async function handleDeleteService(service: ExternalServiceLink) {
    if (!canManage || deleteExternalServiceMutation.isPending) {
      return;
    }

    const result = await appSwal.fire({
      icon: "warning",
      title: "ลบลิงก์ E-Service?",
      text: service.title,
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    showBlockingLoading("กำลังลบ E-Service");

    try {
      await deleteExternalServiceMutation.mutateAsync(service.id);
      const nextPage = adminListQuery.data ? getAdminPageAfterDelete(adminListQuery.data.pagination) : page;

      if (nextPage !== page) {
        setPage(nextPage);
      }
      await invalidateExternalServiceData();
      await appSwal.close();
      await showSuccessResult("ลบ E-Service แล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถลบ E-Service ได้", error, "กรุณาลองอีกครั้ง");
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

  function handleMoveOrder(item: AdminExternalServiceOrderItem, direction: -1 | 1) {
    if (!canManage || saveOrderMutation.isPending) {
      return;
    }

    setOrderDraft((current) => moveExternalServiceOrder(current ?? serverOrder, item.id, direction));
  }

  function handleToggleOrderEnabled(item: AdminExternalServiceOrderItem, enabled: boolean) {
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

    showBlockingLoading("กำลังบันทึกลำดับ E-Service");

    try {
      const saved = await saveOrderMutation.mutateAsync(orderedServices);
      queryClient.setQueryData(adminListQueryKeys.order("external-services"), saved);
      setOrderDraft(null);
      await Promise.all([
        invalidateAdminListQueries(queryClient, "external-services"),
        invalidatePublicCmsData(queryClient)
      ]);
      await appSwal.close();
      await showSuccessResult("บันทึกลำดับ E-Service แล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกลำดับ E-Service ได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function renderServiceIcon(iconKey: ExternalServiceIconKey, tone: ExternalServiceTone) {
    const toneStyle = getExternalServiceToneStyle(tone);

    return (
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: designTokens.radius.medium,
          display: "grid",
          placeItems: "center",
          color: toneStyle.iconColor,
          bgcolor: toneStyle.iconBg,
          boxShadow: designTokens.elevation.medium,
          "& svg": {
            fontSize: 27
          }
        }}
      >
        {getExternalServiceIcon(iconKey)}
      </Box>
    );
  }

  return (
    <Box sx={{ color: "var(--rcat-text)" }}>
      <PageHeader
        title="E-Service"
        description="จัดการลิงก์บริการออนไลน์ที่แสดงในหน้าเว็บไซต์สาธารณะ"
        action={
          canManage ? (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                alignItems: { xs: "stretch", sm: "center" }
              }}
            >
              {orderingMode ? (
                <>
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
                </>
              ) : (
                <>
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
                    onClick={() => void handleAddService()}
                    disabled={listTransitioning || saveExternalServiceMutation.isPending}
                  >
                    เพิ่มลิงก์บริการ
                  </Button>
                </>
              )}
            </Stack>
          ) : undefined
        }
      />
      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}
      {orderingMode ? (
        <Card>
          {(orderQuery.isLoading || orderQuery.isFetching) && <LinearProgress />}
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.15rem" }}>
                  จัดลำดับ E-Service ทั้งหมด
                </Typography>
                <Typography
                  sx={{
                    color: "text.secondary",
                    mt: 0.5
                  }}
                >
                  โหลดเฉพาะข้อมูลลำดับแบบย่อ ไม่ใช้รายการที่แบ่งหน้าในการบันทึกทั้งชุด
                </Typography>
              </Box>
              {orderQuery.isError && (
                <Alert severity="error">
                  {orderQuery.error instanceof Error ? orderQuery.error.message : "ไม่สามารถโหลดลำดับ E-Service ได้"}
                </Alert>
              )}
              {!orderQuery.isLoading && !orderedServices.length && !orderQuery.isError && (
                <Typography
                  sx={{
                    color: "text.secondary"
                  }}
                >
                  ยังไม่มี E-Service ให้จัดลำดับ
                </Typography>
              )}
              {orderedServices.map((service, index) => (
                <Stack
                  key={service.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{
                    alignItems: { xs: "stretch", sm: "center" },
                    p: 1.5,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2
                  }}
                >
                  <Chip label={`ลำดับ ${index + 1}`} size="small" sx={{ alignSelf: "flex-start" }} />
                  <Typography
                    sx={{
                      fontWeight: 800,
                      flex: 1,
                      minWidth: 0
                    }}
                  >
                    {service.title}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={service.enabled}
                        onChange={(event) => handleToggleOrderEnabled(service, event.target.checked)}
                        disabled={saveOrderMutation.isPending}
                      />
                    }
                    label="เปิดใช้งาน"
                  />
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      aria-label={`เลื่อนขึ้น ${service.title}`}
                      onClick={() => handleMoveOrder(service, -1)}
                      disabled={index === 0 || saveOrderMutation.isPending}
                    >
                      <ArrowUpwardOutlinedIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`เลื่อนลง ${service.title}`}
                      onClick={() => handleMoveOrder(service, 1)}
                      disabled={index === orderedServices.length - 1 || saveOrderMutation.isPending}
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
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    label="ค้นหา E-Service"
                    value={q}
                    onChange={(event) => setSearch(event.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="external-service-enabled-filter-label">สถานะ</InputLabel>
                    <Select
                      labelId="external-service-enabled-filter-label"
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
                <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="external-service-tone-filter-label">ประเภท</InputLabel>
                    <Select
                      labelId="external-service-tone-filter-label"
                      label="ประเภท"
                      value={toneFilter}
                      onChange={(event) => setFilter("tone", event.target.value)}
                    >
                      <MenuItem value="all">ทั้งหมด</MenuItem>
                      {externalServiceToneOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="external-service-sort-label">เรียงตาม</InputLabel>
                    <Select
                      labelId="external-service-sort-label"
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
              {adminListQuery.error instanceof Error
                ? adminListQuery.error.message
                : "ไม่สามารถโหลดลิงก์ E-Service ได้"}
            </Alert>
          )}

          {!adminListQuery.isLoading && !listTransitioning && !services.length && !adminListQuery.isError && (
            <Card>
              <CardContent>
                <Stack
                  spacing={2}
                  sx={{
                    alignItems: "flex-start"
                  }}
                >
                  <ExternalServiceIcon iconKey="apps" color="primary" sx={{ fontSize: 44 }} />
                  <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                    {q || enabledFilter !== "all" || toneFilter !== "all"
                      ? "ไม่พบ E-Service ที่ตรงกับเงื่อนไข"
                      : "ยังไม่มีลิงก์ E-Service"}
                  </Typography>
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
            {services.map((service) => (
              <Grid key={service.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <Card
                  sx={{
                    height: "100%",
                    boxShadow: designTokens.elevation.low
                  }}
                >
                  <CardContent>
                    <Stack spacing={1.5} sx={{ height: "100%" }}>
                      <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{
                          alignItems: "flex-start",
                          justifyContent: "space-between"
                        }}
                      >
                        {renderServiceIcon(service.iconKey, service.tone)}
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{
                            alignItems: "center"
                          }}
                        >
                          {service.href && (
                            <IconButton
                              aria-label={`เปิดลิงก์บริการ ${service.title}`}
                              component="a"
                              href={normalizeSafeHref(service.href)}
                              target="_blank"
                              rel="noreferrer"
                              size="small"
                            >
                              <OpenInNewOutlinedIcon fontSize="small" />
                            </IconButton>
                          )}
                          {canManage && (
                            <>
                              <IconButton
                                aria-label={`แก้ไขลิงก์ E-Service ${service.title}`}
                                onClick={() => handleEditService(service)}
                                disabled={listTransitioning || saveExternalServiceMutation.isPending}
                                size="small"
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                aria-label={`ลบลิงก์ E-Service ${service.title}`}
                                color="error"
                                disabled={listTransitioning || deleteExternalServiceMutation.isPending}
                                onClick={() => void handleDeleteService(service)}
                                size="small"
                              >
                                <DeleteOutlineOutlinedIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </Stack>
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{
                          alignItems: "center",
                          flexWrap: "wrap"
                        }}
                      >
                        <Chip
                          label={service.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                          size="small"
                          color={service.enabled ? "success" : "warning"}
                          variant={service.enabled ? "filled" : "outlined"}
                        />
                        <Chip label={getToneLabel(service.tone)} size="small" variant="outlined" />
                        <Chip label={getIconLabel(service.iconKey)} size="small" variant="outlined" />
                        <Chip label={`ลำดับ ${service.order}`} size="small" variant="outlined" />
                      </Stack>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h3" sx={{ fontSize: "1.12rem" }}>
                          {service.title || "ไม่มีชื่อบริการ"}
                        </Typography>
                        {service.description && (
                          <Typography
                            className="content-summary"
                            sx={{
                              color: "text.secondary",
                              mt: 0.75
                            }}
                          >
                            {service.description}
                          </Typography>
                        )}
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          wordBreak: "break-word"
                        }}
                      >
                        {service.href || "ยังไม่มี URL"}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md" transitionDuration={0}>
        <DialogTitle>{isCreating ? "เพิ่มลิงก์ E-Service" : "แก้ไขลิงก์ E-Service"}</DialogTitle>
        <DialogContent dividers>
          {editingService && (
            <Grid container spacing={2.5} sx={{ pt: 1 }}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={2}>
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <Chip label={`ลำดับ ${editingService.order}`} size="small" variant="outlined" />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingService.enabled}
                          onChange={(event) => updateEditingService("enabled", event.target.checked)}
                          disabled={!canManage}
                        />
                      }
                      label="เปิดใช้งาน"
                    />
                  </Stack>
                  <TextField
                    label="ชื่อบริการ"
                    value={editingService.title}
                    onChange={(event) => updateEditingService("title", event.target.value)}
                    helperText="ชื่อบริการที่จะแสดงบนหน้าเว็บไซต์"
                    required
                    disabled={!canManage}
                    fullWidth
                  />
                  <TextField
                    label="คำอธิบาย"
                    value={editingService.description}
                    onChange={(event) => updateEditingService("description", event.target.value)}
                    minRows={3}
                    multiline
                    disabled={!canManage}
                    fullWidth
                  />
                  <TextField
                    label="URL บริการ"
                    value={editingService.href}
                    onChange={(event) => updateEditingService("href", event.target.value)}
                    helperText="กรอก URL จริงของระบบบริการ เช่น https://..."
                    required
                    disabled={!canManage}
                    fullWidth
                  />
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel id="external-service-tone-label">ประเภทสี</InputLabel>
                        <Select
                          labelId="external-service-tone-label"
                          label="ประเภทสี"
                          value={editingService.tone}
                          onChange={(event) => updateEditingService("tone", event.target.value as ExternalServiceTone)}
                          disabled={!canManage}
                        >
                          {externalServiceToneOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel id="external-service-icon-label">ไอคอน</InputLabel>
                        <Select
                          labelId="external-service-icon-label"
                          label="ไอคอน"
                          value={editingService.iconKey}
                          onChange={(event) =>
                            updateEditingService("iconKey", event.target.value as ExternalServiceIconKey)
                          }
                          disabled={!canManage}
                        >
                          {externalServiceIconOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 5 }}>
                <Card variant="outlined" sx={{ bgcolor: "primary.light", borderColor: "divider" }}>
                  <CardContent>
                    <Stack spacing={1.35}>
                      <Stack
                        direction="row"
                        spacing={1.1}
                        sx={{
                          alignItems: "flex-start",
                          justifyContent: "space-between"
                        }}
                      >
                        {renderServiceIcon(editingService.iconKey, editingService.tone)}
                        <OpenInNewOutlinedIcon sx={{ color: "text.secondary", fontSize: 19 }} />
                      </Stack>
                      <Stack spacing={0.75}>
                        <Typography variant="h3" sx={{ fontSize: "1rem", lineHeight: 1.32 }}>
                          {editingService.title || "ชื่อบริการ"}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            lineHeight: 1.55
                          }}
                        >
                          {editingService.description || "คำอธิบายบริการ"}
                        </Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button color="inherit" onClick={handleCloseDialog} disabled={saveExternalServiceMutation.isPending}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={!canManage || saveExternalServiceMutation.isPending}
            onClick={() => void handleSaveDialog()}
          >
            บันทึกลิงก์ E-Service
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
