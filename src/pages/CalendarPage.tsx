import {
  useMemo,
  useState } from "react";
import { useMutation,
  useQuery,
  useQueryClient } from "@tanstack/react-query";
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
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import dayjs from "dayjs";
import PageHeader from "../components/PageHeader";
import { deleteCalendarEvent, getCmsSnapshot, saveCalendarEvent } from "../services/googleApi";
import { CalendarEvent } from "../types";
import {
  getCalendarDateRangeError,
  isEndDateTimeBeforeStart,
  toLocalDateTimeInputValue
} from "../utils/calendar";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime
} from "../utils/dateDisplay";
import { appSwal } from "../utils/swal";
import { eventStatusLabels, visibilityLabels } from "../utils/thaiLabels";

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
}

type EventStatusFilter = CalendarEvent["status"] | "all";

const emptyForm: EventFormState = {
  title: "",
  audience: "",
  dateTime: dayjs().add(1, "day").format("YYYY-MM-DDTHH:mm"),
  endDateTime: "",
  status: "confirmed",
  location: "",
  description: "",
  category: "วิชาการ",
  visibility: "public"
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
    category: event.category || "Academic",
    visibility: event.visibility ?? "public"
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

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });
  const events = useMemo(
    () =>
      [...(data?.events ?? [])].sort(
        (left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf()
      ),
    [data]
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | undefined>();
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>("all");
  const endDateError = getCalendarDateRangeError(form.dateTime, form.endDateTime);

  const editingEvent = events.find((event) => event.id === editingEventId);
  const isEditing = Boolean(editingEvent);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesStatus = statusFilter === "all" || event.status === statusFilter;
      const matchesSearch =
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.audience.toLowerCase().includes(query) ||
        (event.location ?? "").toLowerCase().includes(query) ||
        (event.category ?? "").toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [events, search, statusFilter]);

  const saveMutation = useMutation({
    mutationFn: saveCalendarEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCalendarEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

  function handleCreate() {
    setEditingEventId(undefined);
    setForm(emptyForm);
    setFormError("");
    setConfirming(false);
    setDialogOpen(true);
  }

  function handleEdit(event: CalendarEvent) {
    setEditingEventId(event.id);
    setForm(toFormState(event));
    setFormError("");
    setConfirming(false);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingEventId(undefined);
    setForm(emptyForm);
    setFormError("");
    setConfirming(false);
  }

  function handleSave() {
    if (!form.title.trim() || !form.audience.trim() || !form.dateTime) {
      setFormError("ต้องระบุชื่อกิจกรรม กลุ่มเป้าหมาย และวันที่เริ่มต้น");
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
    try {
      await saveMutation.mutateAsync({
        id: editingEventId,
        title: form.title.trim(),
        audience: form.audience.trim(),
        date: dayjs(form.dateTime).toISOString(),
        endDate: form.endDateTime ? dayjs(form.endDateTime).toISOString() : "",
        status: form.status,
        location: form.location.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        visibility: form.visibility
      });
      handleClose();
      await waitForDialogTransition();
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isEditing ? "อัปเดตกิจกรรมแล้ว" : "เพิ่มกิจกรรมแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      setFormError(currentError instanceof Error ? currentError.message : "กรุณาตรวจสอบรายละเอียดกิจกรรม");
      setConfirming(false);
    }
  }

  async function handleDelete(event: CalendarEvent) {
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

    try {
      await deleteMutation.mutateAsync(event.id);
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ลบกิจกรรมแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบกิจกรรมได้",
        text: currentError instanceof Error ? currentError.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="ปฏิทินกิจกรรม"
        description="สร้าง ตั้งเวลา เผยแพร่ ยกเลิก และลบกิจกรรมปฏิทินสาธารณะ"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            เพิ่มกิจกรรม
          </Button>
        }
      />
      {isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : "ไม่สามารถโหลดกิจกรรมปฏิทินได้ในขณะนี้"}
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
          placeholder="ค้นหากิจกรรม"
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
          value={statusFilter}
          exclusive
          onChange={(_, value: EventStatusFilter | null) => value && setStatusFilter(value)}
          size="small"
          aria-label="ตัวกรองสถานะกิจกรรม"
        >
          {(["all", "confirmed", "draft", "cancelled"] as EventStatusFilter[]).map((status) => (
            <ToggleButton key={status} value={status} sx={{ textTransform: "capitalize" }}>
              {status === "all" ? "ทั้งหมด" : eventStatusLabels[status]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <Stack spacing={2}>
        {filteredEvents.map((event) => (
          <Card key={event.id}>
            <CardContent>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", md: "center" }}
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
                      <Typography variant="h3" sx={{ fontSize: "1.1rem" }}>
                        {event.title}
                      </Typography>
                      <Chip
                        label={eventStatusLabels[event.status]}
                        size="small"
                        color={getStatusColor(event.status)}
                        sx={{ textTransform: "capitalize" }}
                      />
                      <Chip
                        label={visibilityLabels[event.visibility ?? "public"]}
                        size="small"
                        variant="outlined"
                        sx={{ textTransform: "capitalize" }}
                      />
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
                  justifyContent={{ xs: "space-between", md: "flex-end" }}
                  sx={{ width: { xs: "100%", md: "auto" } }}
                >
                  <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                    <Typography fontWeight={900}>{formatDisplayDate(event.date)}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {formatDisplayTime(event.date)}
                      {event.endDate ? ` - ${formatDisplayTime(event.endDate)}` : ""}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="แก้ไขกิจกรรม">
                      <IconButton aria-label="แก้ไขกิจกรรม" size="small" onClick={() => handleEdit(event)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบกิจกรรม">
                      <IconButton
                        aria-label="ลบกิจกรรม"
                        size="small"
                        color="error"
                        onClick={() => void handleDelete(event)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {!isLoading && !filteredEvents.length && (
          <Typography color="text.secondary">ไม่มีกิจกรรมที่ตรงกับมุมมองนี้</Typography>
        )}
      </Stack>
      <Dialog open={dialogOpen} onClose={saveMutation.isPending ? undefined : handleClose} fullWidth maxWidth="md">
        <DialogTitle>
          {confirming
            ? isEditing
              ? "บันทึกกิจกรรม?"
              : "เพิ่มกิจกรรม?"
            : isEditing
              ? "แก้ไขกิจกรรม"
              : "เพิ่มกิจกรรม"}
        </DialogTitle>
        <DialogContent dividers>
          {confirming ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
                {formError && <Alert severity="error">{formError}</Alert>}
                <Typography color="text.secondary">
                  ตรวจสอบกิจกรรมนี้ก่อนบันทึก
                </Typography>
                <Typography fontWeight={900}>{form.title}</Typography>
                <Typography color="text.secondary">
                {form.audience} / {formatDisplayDateTime(form.dateTime)} / {form.status}
                </Typography>
            </Stack>
          ) : (
            <Stack spacing={2.2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField
                label="ชื่อกิจกรรม"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                required
                fullWidth
              />
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="กลุ่มเป้าหมาย"
                    value={form.audience}
                    onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="สถานที่"
                    value={form.location}
                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
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
                    slotProps={{ inputLabel: { shrink: true } }}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="สิ้นสุด"
                    type="datetime-local"
                    value={form.endDateTime}
                    onChange={(event) => setForm((current) => ({ ...current, endDateTime: event.target.value }))}
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: { min: form.dateTime || undefined }
                    }}
                    error={Boolean(endDateError)}
                    helperText={endDateError || "ไม่บังคับ"}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
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
                      <MenuItem key={status} value={status} sx={{ textTransform: "capitalize" }}>
                        {eventStatusLabels[status]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="หมวดหมู่"
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
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
                      <MenuItem key={visibility} value={visibility} sx={{ textTransform: "capitalize" }}>
                        {visibilityLabels[visibility]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <TextField
                label="รายละเอียด"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                minRows={4}
                multiline
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {confirming ? (
            <>
              <Button color="inherit" onClick={() => setConfirming(false)} disabled={saveMutation.isPending}>
                กลับ
              </Button>
              <Button variant="contained" disabled={saveMutation.isPending} onClick={() => void handleConfirmSave()}>
                {saveMutation.isPending ? "กำลังบันทึก" : isEditing ? "บันทึก" : "เพิ่มกิจกรรม"}
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" onClick={handleClose} disabled={saveMutation.isPending}>
                ยกเลิก
              </Button>
              <Button variant="contained" startIcon={<EventAvailableOutlinedIcon />} disabled={saveMutation.isPending} onClick={handleSave}>
                ดำเนินการต่อ
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
