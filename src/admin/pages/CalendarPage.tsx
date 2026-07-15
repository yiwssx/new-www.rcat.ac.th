import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import dayjs from "dayjs";
import AdminPagination from "../components/AdminPagination";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../../context/authSessionContext";
import { deleteCalendarEvent, saveCalendarEvent } from "../../features/cms-events";
import type { CalendarEvent, MediaAsset } from "../../types";
import {
  ADMIN_MEDIA_BY_IDS_MAX,
  ADMIN_PAGE_SIZE_OPTIONS,
  getAdminMediaByIds,
  getAdminPageAfterDelete,
  invalidateAdminListQueries,
  useAdminEventListQuery,
  useAdminListUrlState,
  useAdminMediaListQuery,
  useDebouncedValue
} from "../../features/admin-pagination";
import {
  fromLocalDateTimeInputValue,
  getCalendarDateRangeError,
  isEndDateTimeBeforeStart,
  toLocalDateTimeInputValue
} from "../../utils/calendar";
import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from "../../utils/dateDisplay";
import { normalizePublicImageUrl } from "../../utils/safeUrl";
import { appSwal, getSwalErrorText, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { eventStatusLabels, visibilityLabels } from "../../utils/thaiLabels";
import { ADMIN_READ_ONLY_NOTICE, canManageContent } from "../utils/rbac";

const MAX_EVENT_MEDIA_ATTACHMENTS = 12;

interface EventFormState {
  title: string;
  audience: string;
  dateTime: string;
  endDateTime: string;
  status: CalendarEvent["status"];
  location: string;
  description: string;
  category: string;
  visibility: NonNullable<CalendarEvent["visibility"]>;
  mediaIds: string[];
}

type EventStatusFilter = CalendarEvent["status"] | "all";

type EventFilterKey = "status";

const eventListUrlOptions = {
  defaultPageSize: 25,
  pageSizeOptions: ADMIN_PAGE_SIZE_OPTIONS,
  defaultSortBy: "date",
  defaultSortDirection: "desc" as const,
  filterDefaults: {
    status: "all"
  }
};

const emptyForm: EventFormState = {
  title: "",
  audience: "",
  dateTime: dayjs().add(1, "day").format("YYYY-MM-DDTHH:mm"),
  endDateTime: "",
  status: "confirmed",
  location: "",
  description: "",
  category: "วิชาการ",
  visibility: "public",
  mediaIds: []
};

function waitForDialogTransition() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 220);
  });
}

function toFormState(event: CalendarEvent): EventFormState {
  return {
    title: event.title,
    audience: event.audience,
    dateTime: toLocalDateTimeInputValue(event.date),
    endDateTime: toLocalDateTimeInputValue(event.endDate),
    status: event.status,
    location: event.location ?? "",
    description: event.description ?? "",
    category: event.category || "วิชาการ",
    visibility: event.visibility ?? "public",
    mediaIds: Array.isArray(event.mediaIds)
      ? event.mediaIds
          .map((id) => String(id).trim())
          .filter(Boolean)
          .filter((id, index, items) => items.indexOf(id) === index)
          .slice(0, MAX_EVENT_MEDIA_ATTACHMENTS)
      : []
  };
}

function getStatusColor(status: CalendarEvent["status"]) {
  if (status === "confirmed") {
    return "success";
  }

  if (status === "cancelled") {
    return "error";
  }

  return "default";
}

function getMediaPreviewUrl(asset: MediaAsset) {
  return normalizePublicImageUrl(asset.thumbnailUrl || asset.previewUrl || asset.driveUrl || "");
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const canManage = canManageContent(session?.user);

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
  } = useAdminListUrlState<EventFilterKey>(eventListUrlOptions);

  const debouncedSearch = useDebouncedValue(q, 300);

  const statusFilter = (filters.status || "all") as EventStatusFilter;

  const eventListQuery = useAdminEventListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    status: statusFilter,
    sortBy,
    sortDirection
  });

  const listTransitioning = eventListQuery.isPlaceholderData || debouncedSearch !== q;

  const events = eventListQuery.data?.items ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingEventId, setEditingEventId] = useState<string | undefined>();

  const [form, setForm] = useState<EventFormState>(emptyForm);

  const [formError, setFormError] = useState("");

  const [confirming, setConfirming] = useState(false);

  const [mediaSearch, setMediaSearch] = useState("");

  const debouncedMediaSearch = useDebouncedValue(mediaSearch, 300);

  const endDateError = getCalendarDateRangeError(form.dateTime, form.endDateTime);

  const editingEvent = events.find((event) => event.id === editingEventId);

  const isEditing = Boolean(editingEvent);

  const mediaListQuery = useAdminMediaListQuery({
    page: 1,
    pageSize: 96,
    q: debouncedMediaSearch,
    sortBy: "updatedAt",
    sortDirection: "desc"
  });

  const selectedMediaIds = form.mediaIds.slice(0, Math.min(ADMIN_MEDIA_BY_IDS_MAX, MAX_EVENT_MEDIA_ATTACHMENTS));

  const selectedMediaQuery = useQuery({
    queryKey: ["calendar-selected-media", selectedMediaIds],
    queryFn: () => getAdminMediaByIds(selectedMediaIds),
    enabled: dialogOpen && selectedMediaIds.length > 0
  });

  const availableMedia = useMemo(() => {
    const mediaById = new Map<string, MediaAsset>();

    [...(mediaListQuery.data?.items ?? []), ...(selectedMediaQuery.data ?? [])].forEach((asset) => {
      mediaById.set(asset.id, asset);
    });

    return [...mediaById.values()].sort((left, right) => {
      if (left.type === "image" && right.type !== "image") {
        return -1;
      }

      if (left.type !== "image" && right.type === "image") {
        return 1;
      }

      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
  }, [mediaListQuery.data?.items, selectedMediaQuery.data]);

  const selectedMedia = useMemo(() => {
    const mediaById = new Map(availableMedia.map((asset) => [asset.id, asset]));

    return form.mediaIds.map((id) => mediaById.get(id)).filter((asset): asset is MediaAsset => Boolean(asset));
  }, [availableMedia, form.mediaIds]);

  const selectedImages = useMemo(() => selectedMedia.filter((asset) => asset.type === "image"), [selectedMedia]);

  useEffect(() => {
    const responsePage = eventListQuery.data?.pagination.page;

    if (!eventListQuery.isPlaceholderData && responsePage && responsePage !== page) {
      setListState(
        {
          page: responsePage
        },
        {
          replace: true
        }
      );
    }
  }, [eventListQuery.data?.pagination.page, eventListQuery.isPlaceholderData, page, setListState]);

  const saveMutation = useMutation({
    mutationFn: saveCalendarEvent
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCalendarEvent
  });

  const calendarWritePending = saveMutation.isPending || deleteMutation.isPending || listTransitioning;

  function handleCreate() {
    if (!canManage || calendarWritePending) {
      return;
    }

    setEditingEventId(undefined);
    setForm({
      ...emptyForm,
      mediaIds: []
    });
    setMediaSearch("");
    setFormError("");
    setConfirming(false);
    setDialogOpen(true);
  }

  function handleEdit(event: CalendarEvent) {
    if (!canManage || calendarWritePending) {
      return;
    }

    setEditingEventId(event.id);
    setForm(toFormState(event));
    setMediaSearch("");
    setFormError("");
    setConfirming(false);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingEventId(undefined);
    setForm({
      ...emptyForm,
      mediaIds: []
    });
    setMediaSearch("");
    setFormError("");
    setConfirming(false);
  }

  function handleSave() {
    if (!canManage) {
      setFormError(ADMIN_READ_ONLY_NOTICE);
      return;
    }

    if (!form.title.trim() || !form.audience.trim() || !form.dateTime || !form.endDateTime) {
      setFormError("ต้องระบุชื่อกิจกรรม กลุ่มเป้าหมาย วันเวลาเริ่มต้น และวันเวลาสิ้นสุด");
      return;
    }

    if (endDateError) {
      setFormError(endDateError);
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

    if (calendarWritePending) {
      return;
    }

    showBlockingLoading(isEditing ? "กำลังบันทึกกิจกรรม" : "กำลังเพิ่มกิจกรรม");

    try {
      const wasCreating = !editingEventId;

      await saveMutation.mutateAsync({
        id: editingEventId,
        revision: editingEvent?.revision,
        title: form.title.trim(),
        audience: form.audience.trim(),
        date: fromLocalDateTimeInputValue(form.dateTime),
        endDate: fromLocalDateTimeInputValue(form.endDateTime),
        status: form.status,
        location: form.location.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        visibility: form.visibility,
        mediaIds: form.mediaIds
      });

      if (wasCreating) {
        setListState(
          {
            page: 1
          },
          {
            replace: true
          }
        );
      }

      await Promise.all([invalidateAdminListQueries(queryClient, "events"), invalidatePublicCmsData(queryClient)]);

      await appSwal.close();
      handleClose();
      await waitForDialogTransition();

      await showSuccessResult(isEditing ? "บันทึกกิจกรรมสำเร็จ" : "เพิ่มกิจกรรมสำเร็จ");
    } catch (currentError) {
      await appSwal.close();

      setFormError(getSwalErrorText(currentError, "กรุณาตรวจสอบรายละเอียดกิจกรรม"));

      setConfirming(false);

      await showErrorResult("ไม่สามารถบันทึกกิจกรรมได้", currentError, "กรุณาตรวจสอบรายละเอียดกิจกรรม");
    }
  }

  async function handleDelete(event: CalendarEvent) {
    if (!canManage || calendarWritePending) {
      return;
    }

    const result = await appSwal.fire({
      title: "ลบกิจกรรมในปฏิทิน?",
      text: event.title,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    showBlockingLoading("กำลังลบกิจกรรม");

    try {
      await deleteMutation.mutateAsync(event.id);

      const pagination = eventListQuery.data?.pagination;

      if (pagination) {
        const nextPage = getAdminPageAfterDelete(pagination);

        if (nextPage !== page) {
          setListState(
            {
              page: nextPage
            },
            {
              replace: true
            }
          );
        }
      }

      await Promise.all([invalidateAdminListQueries(queryClient, "events"), invalidatePublicCmsData(queryClient)]);

      await appSwal.close();

      await showSuccessResult("ลบกิจกรรมสำเร็จ");
    } catch (currentError) {
      await appSwal.close();

      await showErrorResult("ไม่สามารถลบกิจกรรมได้", currentError, "กรุณาลองอีกครั้ง");
    }
  }

  return (
    <Box>
      <PageHeader
        title="ปฏิทินกิจกรรม"
        description="สร้าง ตั้งเวลา เผยแพร่ ยกเลิก และลบกิจกรรมปฏิทินสาธารณะ"
        action={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} disabled={calendarWritePending} onClick={handleCreate}>
              เพิ่มกิจกรรม
            </Button>
          ) : undefined
        }
      />

      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}

      {eventListQuery.isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {eventListQuery.error instanceof Error
            ? eventListQuery.error.message
            : "ไม่สามารถโหลดกิจกรรมปฏิทินได้ในขณะนี้"}
        </Alert>
      )}

      {eventListQuery.isLoading && <LinearProgress sx={{ mb: 3 }} />}

      {(eventListQuery.isFetching || listTransitioning) && !eventListQuery.isLoading && (
        <LinearProgress sx={{ mb: 1 }} />
      )}

      <Stack
        direction={{
          xs: "column",
          lg: "row"
        }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{
          xs: "stretch",
          lg: "center"
        }}
        sx={{ mb: 2 }}
      >
        <TextField
          placeholder="ค้นหากิจกรรม"
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
          sx={{
            minWidth: {
              lg: 360
            }
          }}
        />

        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, value: EventStatusFilter | null) => value && setFilter("status", value)}
          size="small"
          aria-label="ตัวกรองสถานะกิจกรรม"
        >
          {(["all", "confirmed", "draft", "cancelled"] as EventStatusFilter[]).map((status) => (
            <ToggleButton
              key={status}
              value={status}
              sx={{
                textTransform: "capitalize"
              }}
            >
              {status === "all" ? "ทั้งหมด" : eventStatusLabels[status]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Stack
        spacing={2}
        aria-busy={eventListQuery.isFetching}
        sx={{
          opacity: listTransitioning ? 0.55 : 1,
          transition: "opacity 120ms ease"
        }}
      >
        {events.map((event) => (
          <Card key={event.id}>
            <CardContent>
              <Stack
                direction={{
                  xs: "column",
                  md: "row"
                }}
                spacing={2}
                alignItems={{
                  xs: "flex-start",
                  md: "center"
                }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 68,
                      height: 68,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      color: "secondary.dark",
                      backgroundColor: "secondary.light",
                      flex: "0 0 auto"
                    }}
                  >
                    <Stack spacing={0} alignItems="center">
                      <Typography fontWeight={900}>{dayjs(event.date).format("DD")}</Typography>

                      <Typography variant="caption" fontWeight={800}>
                        {dayjs(event.date).format("MMM")}
                      </Typography>
                    </Stack>
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography
                        variant="h3"
                        sx={{
                          fontSize: "1.1rem"
                        }}
                      >
                        {event.title}
                      </Typography>

                      <Chip
                        label={eventStatusLabels[event.status]}
                        size="small"
                        color={getStatusColor(event.status)}
                        sx={{
                          textTransform: "capitalize"
                        }}
                      />

                      <Chip
                        label={visibilityLabels[event.visibility ?? "public"]}
                        size="small"
                        variant="outlined"
                        sx={{
                          textTransform: "capitalize"
                        }}
                      />

                      {(event.mediaIds?.length ?? 0) > 0 && (
                        <Chip label={`แนบสื่อ ${event.mediaIds?.length ?? 0} รายการ`} size="small" variant="outlined" />
                      )}
                    </Stack>

                    <Typography color="text.secondary">
                      {event.audience}
                      {event.category ? ` / ${event.category}` : ""}
                      {event.location ? ` / ${event.location}` : ""}
                    </Typography>

                    {event.description && (
                      <Typography color="text.secondary" variant="body2" className="content-summary" sx={{ mt: 0.5 }}>
                        {event.description}
                      </Typography>
                    )}
                  </Box>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  justifyContent={{
                    xs: "space-between",
                    md: "flex-end"
                  }}
                  sx={{
                    width: {
                      xs: "100%",
                      md: "auto"
                    }
                  }}
                >
                  <Box
                    sx={{
                      textAlign: {
                        xs: "left",
                        md: "right"
                      }
                    }}
                  >
                    <Typography fontWeight={900}>{formatDisplayDate(event.date)}</Typography>

                    <Typography color="text.secondary" variant="body2">
                      {formatDisplayTime(event.date)}
                      {event.endDate ? ` - ${formatDisplayTime(event.endDate)}` : ""}
                    </Typography>
                  </Box>

                  {canManage && (
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="แก้ไขกิจกรรม">
                        <span>
                          <IconButton
                            aria-label="แก้ไขกิจกรรม"
                            size="small"
                            disabled={calendarWritePending}
                            onClick={() => handleEdit(event)}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="ลบกิจกรรม">
                        <span>
                          <IconButton
                            aria-label="ลบกิจกรรม"
                            size="small"
                            color="error"
                            disabled={calendarWritePending}
                            onClick={() => void handleDelete(event)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}

        {!eventListQuery.isLoading && !events.length && (
          <Typography color="text.secondary">ไม่มีกิจกรรมที่ตรงกับมุมมองนี้</Typography>
        )}
      </Stack>

      {eventListQuery.data && (
        <AdminPagination
          pagination={{
            ...eventListQuery.data.pagination,
            page,
            pageSize
          }}
          pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          disabled={calendarWritePending}
          isFetching={eventListQuery.isFetching}
        />
      )}

      <Dialog open={dialogOpen} onClose={saveMutation.isPending ? undefined : handleClose} fullWidth maxWidth="md">
        <DialogTitle>
          {confirming ? (isEditing ? "บันทึกกิจกรรม?" : "เพิ่มกิจกรรม?") : isEditing ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
        </DialogTitle>

        <DialogContent dividers>
          {confirming ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}

              <Typography color="text.secondary">ตรวจสอบกิจกรรมนี้ก่อนบันทึก</Typography>

              <Typography fontWeight={900}>{form.title}</Typography>

              <Typography color="text.secondary">{form.audience}</Typography>

              <Typography color="text.secondary">
                {formatDisplayDateTime(fromLocalDateTimeInputValue(form.dateTime))}
                {" - "}
                {formatDisplayDateTime(fromLocalDateTimeInputValue(form.endDateTime))}
              </Typography>

              <Typography color="text.secondary">สถานะภายใน: {eventStatusLabels[form.status]}</Typography>

              <Typography color="text.secondary">สื่อแนบ: {form.mediaIds.length} รายการ</Typography>

              {selectedMedia.length > 0 && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {selectedMedia.map((asset) => (
                    <Chip key={asset.id} label={asset.name} size="small" variant="outlined" />
                  ))}
                </Stack>
              )}
            </Stack>
          ) : (
            <Stack spacing={2.2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}

              <TextField
                label="ชื่อกิจกรรม"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                required
                fullWidth
              />

              <Grid container spacing={1.5}>
                <Grid
                  size={{
                    xs: 12,
                    md: 6
                  }}
                >
                  <TextField
                    label="กลุ่มเป้าหมาย"
                    value={form.audience}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        audience: event.target.value
                      }))
                    }
                    required
                    fullWidth
                  />
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    md: 6
                  }}
                >
                  <TextField
                    label="สถานที่"
                    value={form.location}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        location: event.target.value
                      }))
                    }
                    fullWidth
                  />
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}
                >
                  <TextField
                    label="เริ่มต้น"
                    type="datetime-local"
                    value={form.dateTime}
                    onChange={(event) =>
                      setForm((current) => {
                        const nextDateTime = event.target.value;

                        return {
                          ...current,
                          dateTime: nextDateTime,
                          endDateTime: isEndDateTimeBeforeStart(nextDateTime, current.endDateTime)
                            ? nextDateTime
                            : current.endDateTime
                        };
                      })
                    }
                    slotProps={{
                      inputLabel: {
                        shrink: true
                      },
                      htmlInput: {
                        step: 60
                      }
                    }}
                    required
                    fullWidth
                  />
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 6
                  }}
                >
                  <TextField
                    label="สิ้นสุด"
                    type="datetime-local"
                    value={form.endDateTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endDateTime: event.target.value
                      }))
                    }
                    slotProps={{
                      inputLabel: {
                        shrink: true
                      },
                      htmlInput: {
                        min: form.dateTime || undefined,
                        step: 60
                      }
                    }}
                    error={Boolean(endDateError)}
                    helperText={endDateError || "ต้องระบุวันเวลาสิ้นสุด"}
                    required
                    fullWidth
                  />
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 4
                  }}
                >
                  <TextField
                    label="สถานะ"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as CalendarEvent["status"]
                      }))
                    }
                    select
                    fullWidth
                  >
                    {(["confirmed", "draft", "cancelled"] as CalendarEvent["status"][]).map((status) => (
                      <MenuItem
                        key={status}
                        value={status}
                        sx={{
                          textTransform: "capitalize"
                        }}
                      >
                        {eventStatusLabels[status]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 4
                  }}
                >
                  <TextField
                    label="หมวดหมู่"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value
                      }))
                    }
                    fullWidth
                  />
                </Grid>

                <Grid
                  size={{
                    xs: 12,
                    sm: 4
                  }}
                >
                  <TextField
                    label="การมองเห็น"
                    value={form.visibility}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        visibility: event.target.value as NonNullable<CalendarEvent["visibility"]>
                      }))
                    }
                    select
                    fullWidth
                  >
                    {(["public", "private"] as NonNullable<CalendarEvent["visibility"]>[]).map((visibility) => (
                      <MenuItem
                        key={visibility}
                        value={visibility}
                        sx={{
                          textTransform: "capitalize"
                        }}
                      >
                        {visibilityLabels[visibility]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <TextField
                label="รายละเอียด"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
                minRows={4}
                multiline
                fullWidth
              />

              <Divider />

              <Stack spacing={1}>
                <Typography fontWeight={900}>สื่อแนบกิจกรรม</Typography>

                <Typography color="text.secondary" variant="body2">
                  เลือกรูปภาพ เอกสาร หรือวิดีโอจากคลังสื่อ หากยังไม่มีไฟล์ ให้อัปโหลดที่หน้าคลังสื่อก่อน
                </Typography>

                {(mediaListQuery.isError || selectedMediaQuery.isError) && (
                  <Alert severity="warning">
                    ไม่สามารถโหลดข้อมูลสื่อบางส่วนได้ รายการสื่อที่เลือกไว้จะไม่ถูกลบจนกว่าจะบันทึกการเปลี่ยนแปลง
                  </Alert>
                )}

                <Autocomplete
                  multiple
                  options={availableMedia}
                  value={selectedMedia}
                  inputValue={mediaSearch}
                  onInputChange={(_, value) => {
                    setMediaSearch(value);
                  }}
                  onChange={(_, assets) => {
                    const uniqueIds = [...new Set(assets.map((asset) => asset.id))].slice(
                      0,
                      MAX_EVENT_MEDIA_ATTACHMENTS
                    );

                    setForm((current) => ({
                      ...current,
                      mediaIds: uniqueIds
                    }));
                  }}
                  getOptionLabel={(asset) => asset.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  groupBy={(asset) => (asset.type === "image" ? "รูปภาพ" : "สื่ออื่น")}
                  limitTags={4}
                  loading={mediaListQuery.isFetching || selectedMediaQuery.isFetching}
                  loadingText="กำลังโหลดสื่อ"
                  noOptionsText="ไม่พบสื่อที่ตรงกับคำค้นหา"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="เลือกสื่อแนบ"
                      placeholder="ค้นหารูปภาพหรือชื่อไฟล์"
                      helperText={
                        `เลือกได้ไม่เกิน ${MAX_EVENT_MEDIA_ATTACHMENTS} รายการ ` +
                        `แนบแล้ว ${form.mediaIds.length} รายการ`
                      }
                    />
                  )}
                />

                {form.mediaIds.length > selectedMedia.length && (
                  <Alert severity="info">
                    กำลังโหลดรายละเอียดสื่อที่เลือกไว้ หรือมีสื่อบางรายการที่ไม่พบในคลังสื่อ
                  </Alert>
                )}
              </Stack>

              {selectedImages.length > 0 && (
                <Box>
                  <Typography fontWeight={900} sx={{ mb: 1 }}>
                    ตัวอย่างรูปภาพที่เลือก
                  </Typography>

                  <Grid container spacing={1.25}>
                    {selectedImages.map((asset) => {
                      const previewUrl = getMediaPreviewUrl(asset);

                      if (!previewUrl) {
                        return null;
                      }

                      return (
                        <Grid
                          size={{
                            xs: 6,
                            sm: 4
                          }}
                          key={asset.id}
                        >
                          <Box
                            sx={{
                              height: "100%",
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 2,
                              overflow: "hidden",
                              bgcolor: "background.paper"
                            }}
                          >
                            <Box
                              component="img"
                              src={previewUrl}
                              alt={asset.name}
                              loading="lazy"
                              decoding="async"
                              sx={{
                                width: "100%",
                                height: 150,
                                objectFit: "contain",
                                display: "block",
                                bgcolor: "background.default"
                              }}
                            />

                            <Typography
                              variant="caption"
                              fontWeight={800}
                              sx={{
                                display: "block",
                                p: 1,
                                overflowWrap: "anywhere"
                              }}
                            >
                              {asset.name}
                            </Typography>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2
          }}
        >
          {confirming ? (
            <>
              <Button color="inherit" onClick={() => setConfirming(false)} disabled={saveMutation.isPending}>
                กลับ
              </Button>

              <Button
                variant="contained"
                disabled={!canManage || saveMutation.isPending}
                onClick={() => void handleConfirmSave()}
              >
                {saveMutation.isPending ? "กำลังบันทึก" : isEditing ? "บันทึก" : "เพิ่มกิจกรรม"}
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" onClick={handleClose} disabled={saveMutation.isPending}>
                ยกเลิก
              </Button>

              <Button
                variant="contained"
                startIcon={<EventAvailableOutlinedIcon />}
                disabled={!canManage || saveMutation.isPending}
                onClick={handleSave}
              >
                ดำเนินการต่อ
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
