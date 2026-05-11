import { ReactNode, useMemo, useState } from "react";
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
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import PageHeader from "../components/PageHeader";
import {
  deleteExternalServiceLinkFromApi,
  getAdminCmsSnapshot,
  saveExternalServiceLinkToApi
} from "../../services/googleApi";
import { clearPublicCmsCache } from "../../services/publicCmsCache";
import { ExternalServiceIconKey, ExternalServiceLink, ExternalServiceTone } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { appSwal } from "../../utils/swal";

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

function sortExternalServices(services: ExternalServiceLink[]) {
  return [...services].sort((left, right) => {
    const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : 0;
    const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : 0;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "");
  });
}

function createExternalServiceDraft(order: number): ExternalServiceLink {
  return {
    id: `external-service-${Date.now()}`,
    title: "",
    description: "",
    href: "",
    tone: "general",
    iconKey: "link",
    enabled: false,
    order,
    updatedAt: new Date().toISOString()
  };
}

function normalizeExternalServiceDraft(service: ExternalServiceLink): ExternalServiceLink {
  const order = Number(service.order);

  return {
    ...service,
    title: service.title.trim(),
    description: service.description.trim(),
    href: service.href.trim(),
    tone: service.tone || "general",
    iconKey: service.iconKey || "link",
    enabled: Boolean(service.enabled),
    order: Number.isFinite(order) ? order : 0
  };
}

function getToneLabel(tone: ExternalServiceTone) {
  return externalServiceToneOptions.find((option) => option.value === tone)?.label ?? "ทั่วไป";
}

function getIconLabel(iconKey: ExternalServiceIconKey) {
  return externalServiceIconOptions.find((option) => option.value === iconKey)?.label ?? "ลิงก์ทั่วไป";
}

function getExternalServiceToneColor(tone: ExternalServiceTone) {
  const colors: Record<ExternalServiceTone, string> = {
    student: "#6d28d9",
    homeroom: "#7c3aed",
    management: "#4c1d95",
    learning: "#5b21b6",
    calendar: "#9333ea",
    check: "#6b21a8",
    admission: "#8b5cf6",
    career: "#581c87",
    general: "#1f5a2c"
  };

  return colors[tone] ?? colors.general;
}

function getExternalServiceIcon(iconKey: ExternalServiceIconKey): ReactNode {
  const icons: Record<ExternalServiceIconKey, ReactNode> = {
    apps: <AppsOutlinedIcon />,
    calendar: <CalendarMonthOutlinedIcon />,
    check: <FactCheckOutlinedIcon />,
    groups: <GroupsOutlinedIcon />,
    handshake: <HandshakeOutlinedIcon />,
    registration: <HowToRegOutlinedIcon />,
    book: <MenuBookOutlinedIcon />,
    school: <SchoolOutlinedIcon />,
    link: <LinkOutlinedIcon />
  };

  return icons[iconKey] ?? icons.link;
}

function isAllowedExternalServiceHref(href: string) {
  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(href);
}

function isExampleHref(href: string) {
  return href.toLowerCase().includes("example.com");
}

export default function ExternalServicesPage() {
  const queryClient = useQueryClient();
  const adminSnapshotQuery = useQuery({
    queryKey: ["cms-snapshot", "admin"],
    queryFn: getAdminCmsSnapshot
  });
  const services = useMemo(
    () => sortExternalServices(adminSnapshotQuery.data?.externalServices ?? []),
    [adminSnapshotQuery.data?.externalServices]
  );
  const [editingService, setEditingService] = useState<ExternalServiceLink | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const saveExternalServiceMutation = useMutation({
    mutationFn: saveExternalServiceLinkToApi
  });
  const deleteExternalServiceMutation = useMutation({
    mutationFn: deleteExternalServiceLinkFromApi
  });

  function updateEditingService<K extends keyof ExternalServiceLink>(key: K, value: ExternalServiceLink[K]) {
    setEditingService((current) =>
      current
        ? {
            ...current,
            [key]: value
          }
        : current
    );
  }

  function handleAddService() {
    setEditingService(createExternalServiceDraft(services.length + 1));
    setIsCreating(true);
    setDialogOpen(true);
  }

  function handleEditService(service: ExternalServiceLink) {
    setEditingService({ ...service });
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

  async function invalidateExternalServiceData() {
    clearPublicCmsCache();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["cms-snapshot", "admin"] })
    ]);
  }

  async function handleSaveExternalService() {
    if (!editingService) {
      return;
    }

    const nextService = normalizeExternalServiceDraft(editingService);

    if (!nextService.title) {
      await appSwal.fire({
        icon: "warning",
        title: "กรุณาระบุชื่อบริการ",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    if (!nextService.href) {
      await appSwal.fire({
        icon: "warning",
        title: "กรุณาระบุ URL ของบริการ",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    if (isExampleHref(nextService.href)) {
      await appSwal.fire({
        icon: "warning",
        title: "ไม่ควรใช้ลิงก์ตัวอย่าง",
        text: "กรุณาใช้ URL จริงของระบบบริการ",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    if (!isAllowedExternalServiceHref(nextService.href)) {
      await appSwal.fire({
        icon: "warning",
        title: "รูปแบบลิงก์ไม่ถูกต้อง",
        text: "ใช้ลิงก์ https://, http://, mailto:, tel: หรือ path ภายในที่ขึ้นต้นด้วย /",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    try {
      const saved = await saveExternalServiceMutation.mutateAsync(nextService);
      setEditingService(saved);
      handleCloseDialog();
      await invalidateExternalServiceData();
      await appSwal.fire({
        icon: "success",
        title: "บันทึกลิงก์ E-Service แล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกลิงก์ E-Service ได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  async function handleDeleteExternalService(service: ExternalServiceLink) {
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

    try {
      await deleteExternalServiceMutation.mutateAsync(service.id);
      await invalidateExternalServiceData();
      await appSwal.fire({
        icon: "success",
        title: "ลบลิงก์ E-Service แล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถลบลิงก์ E-Service ได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  function renderServiceIcon(iconKey: ExternalServiceIconKey, tone: ExternalServiceTone) {
    return (
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          color: "white",
          bgcolor: getExternalServiceToneColor(tone),
          boxShadow: "0 10px 20px rgba(31, 90, 44, 0.16)",
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
    <Box>
      <PageHeader
        title="E-Service"
        description="จัดการลิงก์บริการออนไลน์ที่แสดงในหน้าเว็บไซต์สาธารณะ"
        action={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleAddService}>
            เพิ่มลิงก์บริการ
          </Button>
        }
      />

      {adminSnapshotQuery.isLoading && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color="text.secondary">กำลังโหลดลิงก์ E-Service...</Typography>
          </CardContent>
        </Card>
      )}

      {adminSnapshotQuery.isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {adminSnapshotQuery.error instanceof Error
            ? adminSnapshotQuery.error.message
            : "ไม่สามารถโหลดลิงก์ E-Service ได้"}
        </Alert>
      )}

      {!adminSnapshotQuery.isLoading && !adminSnapshotQuery.isError && !services.length && (
        <Card>
          <CardContent>
            <Stack spacing={2} alignItems="flex-start">
              <AppsOutlinedIcon color="primary" sx={{ fontSize: 44 }} />
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                  ยังไม่มีลิงก์ E-Service
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  เพิ่มลิงก์บริการออนไลน์เพื่อแสดงในหน้าเว็บไซต์สาธารณะ
                </Typography>
              </Box>
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleAddService}>
                เพิ่มลิงก์บริการ
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2.5}>
        {services.map((service) => (
          <Grid key={service.id} size={{ xs: 12, md: 6, xl: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={1.5} sx={{ height: "100%" }}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start" justifyContent="space-between">
                    {renderServiceIcon(service.iconKey, service.tone)}
                    <Stack direction="row" spacing={0.75} alignItems="center">
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
                      <IconButton
                        aria-label={`แก้ไขลิงก์ E-Service ${service.title}`}
                        onClick={() => handleEditService(service)}
                        size="small"
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        aria-label={`ลบลิงก์ E-Service ${service.title}`}
                        color="error"
                        disabled={deleteExternalServiceMutation.isPending}
                        onClick={() => void handleDeleteExternalService(service)}
                        size="small"
                      >
                        <DeleteOutlineOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
                      <Typography color="text.secondary" className="content-summary" sx={{ mt: 0.75 }}>
                        {service.description}
                      </Typography>
                    )}
                  </Box>

                  <Typography color="text.secondary" variant="body2" sx={{ wordBreak: "break-word" }}>
                    {service.href || "ยังไม่มี URL"}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>{isCreating ? "เพิ่มลิงก์ E-Service" : "แก้ไขลิงก์ E-Service"}</DialogTitle>
        <DialogContent dividers>
          {editingService && (
            <Grid container spacing={2.5} sx={{ pt: 1 }}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editingService.enabled}
                        onChange={(event) => updateEditingService("enabled", event.target.checked)}
                      />
                    }
                    label="เปิดใช้งาน"
                  />
                  <TextField
                    label="ชื่อบริการ"
                    value={editingService.title}
                    onChange={(event) => updateEditingService("title", event.target.value)}
                    helperText="ชื่อบริการที่จะแสดงบนหน้าเว็บไซต์"
                    required
                    fullWidth
                  />
                  <TextField
                    label="คำอธิบาย"
                    value={editingService.description}
                    onChange={(event) => updateEditingService("description", event.target.value)}
                    minRows={3}
                    multiline
                    fullWidth
                  />
                  <TextField
                    label="URL บริการ"
                    value={editingService.href}
                    onChange={(event) => updateEditingService("href", event.target.value)}
                    helperText="กรอก URL จริงของระบบบริการ เช่น https://..."
                    required
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
                        >
                          {externalServiceIconOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="ลำดับ"
                        type="number"
                        value={editingService.order}
                        onChange={(event) => updateEditingService("order", Number(event.target.value))}
                        helperText="ตัวเลขน้อยจะแสดงก่อน"
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 5 }}>
                <Card variant="outlined" sx={{ bgcolor: "#faf5ff", borderColor: "rgba(88, 28, 135, 0.16)" }}>
                  <CardContent>
                    <Stack spacing={1.35}>
                      <Stack direction="row" spacing={1.1} alignItems="flex-start" justifyContent="space-between">
                        {renderServiceIcon(editingService.iconKey, editingService.tone)}
                        <OpenInNewOutlinedIcon sx={{ color: "text.secondary", fontSize: 19 }} />
                      </Stack>
                      <Stack spacing={0.75}>
                        <Typography variant="h3" sx={{ fontSize: "1rem", lineHeight: 1.32 }}>
                          {editingService.title || "ชื่อบริการ"}
                        </Typography>
                        <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.55 }}>
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
            disabled={saveExternalServiceMutation.isPending}
            onClick={() => void handleSaveExternalService()}
          >
            {saveExternalServiceMutation.isPending ? "กำลังบันทึก" : "บันทึกลิงก์ E-Service"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
