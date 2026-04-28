import {
  useEffect,
  useMemo,
  useState } from "react";
import { useMutation,
  useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import PageHeader from "../components/PageHeader";
import UserManagementCard from "../components/UserManagementCard";
import { projectSettings } from "../config/projectSettings";
import {
  dateFormatPresets,
  defaultDisplaySettings,
  loadDisplaySettings,
  saveDisplaySettings
} from "../services/displaySettings";
import { DisplaySettings } from "../types";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayTime
} from "../utils/dateDisplay";
import { appSwal } from "../utils/swal";

function normalizeDisplaySettings(input: Partial<DisplaySettings>): DisplaySettings {
  return {
    dateFormat: String(input.dateFormat || defaultDisplaySettings.dateFormat).trim() || defaultDisplaySettings.dateFormat,
    timeMode: input.timeMode === "12h" ? "12h" : "24h"
  };
}

export default function SettingsPage() {
  const rolePermissions = projectSettings.roles;
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(defaultDisplaySettings);

  const displaySettingsQuery = useQuery({
    queryKey: ["display-settings"],
    queryFn: loadDisplaySettings
  });

  const saveDisplaySettingsMutation = useMutation({
    mutationFn: saveDisplaySettings
  });

  useEffect(() => {
    if (displaySettingsQuery.data) {
      setDisplaySettings(normalizeDisplaySettings(displaySettingsQuery.data));
    }
  }, [displaySettingsQuery.data]);

  const previewDate = useMemo(() => {
    const now = new Date();
    return {
      date: formatDisplayDate(now, displaySettings),
      time: formatDisplayTime(now, displaySettings),
      dateTime: formatDisplayDateTime(now, displaySettings)
    };
  }, [displaySettings]);

  async function handleSaveDisplaySettings() {
    try {
      const nextSettings = normalizeDisplaySettings(displaySettings);
      const saved = await saveDisplaySettingsMutation.mutateAsync(nextSettings);
      setDisplaySettings(normalizeDisplaySettings(saved));
      await appSwal.fire({
        icon: "success",
        title: "บันทึกการแสดงผลแล้ว",
        text: "รูปแบบวันที่และเวลาได้รับการอัปเดตสำหรับ CMS นี้",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกการแสดงผลได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="ตั้งค่า"
        description="สิทธิ์การเผยแพร่ การจัดการผู้ใช้ และรูปแบบการแสดงผล"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <AccessTimeOutlinedIcon color="primary" />
                <Typography variant="h3">การแสดงวันที่และเวลา</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                ใช้รูปแบบวันที่แบบ WordPress และเลือกรูปแบบเวลา 24 ชั่วโมงหรือ 12 ชั่วโมง
              </Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="date-format-preset-label">รูปแบบวันที่สำเร็จรูป</InputLabel>
                    <Select
                      labelId="date-format-preset-label"
                      label="รูปแบบวันที่สำเร็จรูป"
                      value={
                        dateFormatPresets.some((item) => item.value === displaySettings.dateFormat)
                          ? displaySettings.dateFormat
                          : "__custom__"
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "__custom__") {
                          return;
                        }

                        setDisplaySettings((current) => ({
                          ...current,
                          dateFormat: value
                        }));
                      }}
                    >
                      {dateFormatPresets.map((preset) => (
                        <MenuItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </MenuItem>
                      ))}
                      <MenuItem value="__custom__">รูปแบบกำหนดเอง</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="time-mode-label">รูปแบบเวลา</InputLabel>
                    <Select
                      labelId="time-mode-label"
                      label="รูปแบบเวลา"
                      value={displaySettings.timeMode}
                      onChange={(event) =>
                        setDisplaySettings((current) => ({
                          ...current,
                          timeMode: event.target.value === "12h" ? "12h" : "24h"
                        }))
                      }
                    >
                      <MenuItem value="24h">24 ชั่วโมง (14:30)</MenuItem>
                      <MenuItem value="12h">12 ชั่วโมง (2:30 pm)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    disabled={saveDisplaySettingsMutation.isPending}
                    onClick={() => void handleSaveDisplaySettings()}
                    sx={{ height: "100%" }}
                  >
                    {saveDisplaySettingsMutation.isPending ? "กำลังบันทึก" : "บันทึก"}
                  </Button>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="รูปแบบวันที่กำหนดเอง"
                    value={displaySettings.dateFormat}
                    onChange={(event) =>
                      setDisplaySettings((current) => ({
                        ...current,
                        dateFormat: event.target.value
                      }))
                    }
                    helperText="ตัวอย่าง: j F Y | F j, Y | Y-m-d | m/d/Y | d/m/Y"
                    size="small"
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Card
                variant="outlined"
                sx={{
                  mt: 2,
                  borderColor: "rgba(31, 90, 44, 0.18)",
                  bgcolor: "background.default"
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                    ตัวอย่าง
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Typography color="text.secondary">วันที่: {previewDate.date}</Typography>
                    <Typography color="text.secondary">เวลา: {previewDate.time}</Typography>
                    <Typography color="text.secondary">วันที่และเวลา: {previewDate.dateTime}</Typography>
                  </Stack>
                  {displaySettingsQuery.isError && (
                    <Typography color="error" variant="body2" sx={{ mt: 1.2 }}>
                      {displaySettingsQuery.error instanceof Error
                        ? displaySettingsQuery.error.message
                        : "ไม่สามารถโหลดค่าการแสดงผลที่บันทึกไว้ได้"}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <UserManagementCard />
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <ShieldOutlinedIcon color="primary" />
                <Typography variant="h3">บทบาท</Typography>
              </Stack>
              <Stack spacing={1.5}>
                {rolePermissions.map((role) => (
                  <Stack
                    key={role.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid rgba(31, 90, 44, 0.12)"
                    }}
                  >
                    <Box>
                      <Typography fontWeight={900}>{role.role}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {role.scope}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                      <Stack direction="row" alignItems="center">
                        <Checkbox checked={role.canPublish} readOnly />
                        <Typography variant="body2">เผยแพร่</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center">
                        <Checkbox checked={role.canManageUsers} readOnly />
                        <Typography variant="body2">ผู้ใช้</Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <KeyOutlinedIcon color="secondary" />
                <Typography variant="h3">ความปลอดภัย</Typography>
              </Stack>
              <Stack spacing={2}>
                <Box>
                  <Typography fontWeight={900}>ระยะเวลาเซสชัน</Typography>
                  <Typography color="text.secondary">
                    เซสชันที่เข้าสู่ระบบจะหมดอายุตามค่าระบบโดยอัตโนมัติ
                  </Typography>
                </Box>
                <Box>
                  <Typography fontWeight={900}>การป้องกันรหัสผ่าน</Typography>
                  <Typography color="text.secondary">
                    รหัสผ่านถูกจัดเก็บเป็นแฮชที่ปลอดภัยในชีตผู้ใช้
                  </Typography>
                </Box>
                <Box>
                  <Typography fontWeight={900}>การตั้งค่าการ deploy</Typography>
                  <Typography color="text.secondary">
                    การ rewrite เส้นทางพร้อมใช้งานสำหรับการ deploy ผ่าน vercel.json
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
