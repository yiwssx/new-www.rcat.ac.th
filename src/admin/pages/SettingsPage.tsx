import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import PageHeader from "../components/PageHeader";
import UserManagementCard from "../components/UserManagementCard";
import { projectSettings } from "../../config/projectSettings";
import {
  dateFormatPresets,
  defaultDisplaySettings,
  loadDisplaySettings,
  saveDisplaySettings
} from "../../services/displaySettings";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { clearPublicCmsCache } from "../../services/publicCmsCache";
import { defaultSiteSettings, normalizeSiteSettings } from "../../services/siteSettings";
import { getAdminCmsSnapshot, saveHomepageSettingsToApi, saveSiteSettingsToApi } from "../../services/googleApi";
import { DisplaySettings, HomepageSettings, SiteSettings } from "../../types";
import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from "../../utils/dateDisplay";
import { appSwal } from "../../utils/swal";

function normalizeDisplaySettings(input: Partial<DisplaySettings>): DisplaySettings {
  return {
    dateFormat:
      String(input.dateFormat || defaultDisplaySettings.dateFormat).trim() || defaultDisplaySettings.dateFormat,
    timeMode: input.timeMode === "12h" ? "12h" : "24h"
  };
}

const siteSettingFields: Array<{
  key: keyof SiteSettings;
  label: string;
  multiline?: boolean;
  helperText?: string;
}> = [
  { key: "siteName", label: "ชื่อเว็บไซต์" },
  { key: "eyebrow", label: "ข้อความเหนือชื่อเว็บไซต์" },
  { key: "intro", label: "คำแนะนำเว็บไซต์", multiline: true },
  { key: "campus", label: "ชื่อสถานศึกษา/วิทยาเขต" },
  { key: "phone", label: "โทรศัพท์" },
  { key: "fax", label: "โทรสาร" },
  { key: "email", label: "อีเมล" },
  { key: "address", label: "ที่อยู่", multiline: true },
  { key: "admissionUrl", label: "ลิงก์สมัครเรียน", helperText: "ใช้ลิงก์ https:// หรือเว้นว่าง" },
  { key: "facebookUrl", label: "Facebook URL", helperText: "ใช้ลิงก์ https:// หรือเว้นว่าง" },
  { key: "youtubeUrl", label: "YouTube URL", helperText: "ใช้ลิงก์ https:// หรือเว้นว่าง" },
  { key: "tiktokUrl", label: "TikTok URL", helperText: "ใช้ลิงก์ https:// หรือเว้นว่าง" },
  { key: "heroTitle", label: "หัวข้อ Hero" },
  { key: "heroDescription", label: "คำอธิบาย Hero", multiline: true },
  { key: "heroChip", label: "ป้าย Hero" },
  { key: "heroImageUrl", label: "Hero image URL", helperText: "ใช้ลิงก์รูปภาพ https:// หรือเว้นว่าง" },
  { key: "directorName", label: "ชื่อผู้บริหาร" },
  { key: "directorTitle", label: "ตำแหน่งผู้บริหาร" },
  { key: "directorDescription", label: "คำอธิบายผู้บริหาร", multiline: true },
  {
    key: "directorImageUrl",
    label: "รูปภาพผู้บริหาร URL",
    helperText:
      "วางลิงก์รูปภาพแบบ https:// หรือ Google Drive share link ได้ เช่น /file/d/... ระบบจะแปลงเป็นลิงก์รูปภาพให้อัตโนมัติ ควรตั้งค่าไฟล์เป็น Anyone with the link"
  },
  {
    key: "mapUrl",
    label: "Google Maps URL",
    helperText: "ลิงก์เปิด Google Maps เช่น https://maps.app.goo.gl/... หรือเว้นว่าง"
  },
  {
    key: "mapEmbedUrl",
    label: "Google Maps Embed URL",
    helperText: "วางลิงก์ Google Maps Embed หรือโค้ด iframe จาก Google Maps ได้ ระบบจะเก็บเฉพาะค่า src ที่ปลอดภัย"
  },
  { key: "footerTitle", label: "หัวข้อท้ายเว็บ" },
  { key: "footerDescription", label: "คำอธิบายท้ายเว็บ", multiline: true }
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const rolePermissions = projectSettings.roles;
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(defaultDisplaySettings);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [homepageSettings, setHomepageSettings] = useState<HomepageSettings>(normalizeHomepageSettings());
  const [displaySettingsSource, setDisplaySettingsSource] = useState<DisplaySettings | undefined>();
  const [siteSettingsSource, setSiteSettingsSource] = useState<SiteSettings | undefined>();
  const [homepageSettingsSource, setHomepageSettingsSource] = useState<HomepageSettings | undefined>();

  const displaySettingsQuery = useQuery({
    queryKey: ["display-settings"],
    queryFn: loadDisplaySettings
  });
  const adminSnapshotQuery = useQuery({
    queryKey: ["cms-snapshot", "admin"],
    queryFn: getAdminCmsSnapshot
  });

  const saveDisplaySettingsMutation = useMutation({
    mutationFn: saveDisplaySettings
  });
  const saveSiteSettingsMutation = useMutation({
    mutationFn: saveSiteSettingsToApi
  });
  const saveHomepageSettingsMutation = useMutation({
    mutationFn: saveHomepageSettingsToApi
  });

  if (displaySettingsQuery.data && displaySettingsSource !== displaySettingsQuery.data) {
    setDisplaySettingsSource(displaySettingsQuery.data);
    setDisplaySettings(normalizeDisplaySettings(displaySettingsQuery.data));
  }

  if (adminSnapshotQuery.data?.siteSettings && siteSettingsSource !== adminSnapshotQuery.data.siteSettings) {
    setSiteSettingsSource(adminSnapshotQuery.data.siteSettings);
    setSiteSettings(normalizeSiteSettings(adminSnapshotQuery.data.siteSettings));
  }

  if (
    adminSnapshotQuery.data?.homepageSettings &&
    homepageSettingsSource !== adminSnapshotQuery.data.homepageSettings
  ) {
    setHomepageSettingsSource(adminSnapshotQuery.data.homepageSettings);
    setHomepageSettings(normalizeHomepageSettings(adminSnapshotQuery.data.homepageSettings));
  }

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

  function handleSiteSettingsChange(key: keyof SiteSettings, value: string) {
    setSiteSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleHomepageIntroGateChange(key: keyof HomepageSettings["introGate"], value: string | boolean) {
    setHomepageSettings((current) => ({
      ...current,
      introGate: {
        ...current.introGate,
        [key]: value
      }
    }));
  }

  function handleHomepageMarqueeChange(key: keyof HomepageSettings["marquee"], value: string | boolean | number) {
    const nextValue = key === "speedSeconds" ? Math.min(90, Math.max(12, Number(value) || 32)) : value;

    setHomepageSettings((current) => ({
      ...current,
      marquee: {
        ...current.marquee,
        [key]: nextValue
      }
    }));
  }

  function handleHomepageIntroVideoChange(key: keyof HomepageSettings["introVideo"], value: string | boolean) {
    setHomepageSettings((current) => ({
      ...current,
      introVideo: {
        ...current.introVideo,
        [key]: value
      }
    }));
  }

  async function handleSaveSiteSettings() {
    try {
      const saved = await saveSiteSettingsMutation.mutateAsync(siteSettings);
      setSiteSettings(normalizeSiteSettings(saved));
      clearPublicCmsCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] }),
        queryClient.invalidateQueries({ queryKey: ["cms-snapshot", "admin"] })
      ]);
      await appSwal.fire({
        icon: "success",
        title: "บันทึกข้อมูลเว็บไซต์สาธารณะแล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกข้อมูลเว็บไซต์สาธารณะได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  async function handleSaveHomepageSettings() {
    try {
      const nextSettings = normalizeHomepageSettings(homepageSettings);
      const saved = await saveHomepageSettingsMutation.mutateAsync(nextSettings);
      setHomepageSettings(normalizeHomepageSettings(saved));
      clearPublicCmsCache();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] }),
        queryClient.invalidateQueries({ queryKey: ["cms-snapshot", "admin"] })
      ]);
      await appSwal.fire({
        icon: "success",
        title: "บันทึกการตั้งค่าหน้าแรกแล้ว",
        confirmButtonText: "ตกลง"
      });
    } catch (error) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกการตั้งค่าหน้าแรกได้",
        text: error instanceof Error ? error.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  return (
    <Box>
      <PageHeader title="ตั้งค่า" description="สิทธิ์การเผยแพร่ การจัดการผู้ใช้ และรูปแบบการแสดงผล" />
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
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <LanguageOutlinedIcon color="primary" />
                <Typography variant="h3">ข้อมูลเว็บไซต์สาธารณะ</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                ข้อมูลส่วนนี้จะแสดงในหน้าเว็บไซต์สาธารณะและถูกบันทึกใน Settings sheet ของ Apps Script
              </Typography>
              <Grid container spacing={1.5}>
                {siteSettingFields.map((field) => (
                  <Grid size={{ xs: 12, md: field.multiline ? 12 : 6 }} key={field.key}>
                    <TextField
                      label={field.label}
                      value={siteSettings[field.key]}
                      onChange={(event) => handleSiteSettingsChange(field.key, event.target.value)}
                      helperText={field.helperText}
                      multiline={field.multiline}
                      minRows={field.multiline ? 3 : undefined}
                      size="small"
                      fullWidth
                    />
                  </Grid>
                ))}
                <Grid size={{ xs: 12 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    disabled={saveSiteSettingsMutation.isPending}
                    onClick={() => void handleSaveSiteSettings()}
                  >
                    {saveSiteSettingsMutation.isPending ? "กำลังบันทึก" : "บันทึกข้อมูลเว็บไซต์"}
                  </Button>
                  {adminSnapshotQuery.isError && (
                    <Typography color="error" variant="body2" sx={{ mt: 1.2 }}>
                      {adminSnapshotQuery.error instanceof Error
                        ? adminSnapshotQuery.error.message
                        : "ไม่สามารถโหลดข้อมูลเว็บไซต์สาธารณะได้"}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <CampaignOutlinedIcon color="primary" />
                <Typography variant="h3">การตั้งค่าหน้าแรก</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                ควบคุมส่วน Intro Gate, ประกาศวิ่ง และวิดีโอแนะนำสถานศึกษาที่แสดงในหน้าเว็บไซต์สาธารณะ
              </Typography>

              {adminSnapshotQuery.isError && (
                <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                  ไม่สามารถโหลดการตั้งค่าหน้าแรกได้
                </Typography>
              )}

              <Stack spacing={2.4} divider={<Divider flexItem />}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.5 }}>
                    <LoginRoundedIcon color="primary" />
                    <Typography variant="h4">Intro Gate</Typography>
                  </Stack>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={homepageSettings.introGate.enabled}
                            onChange={(event) => handleHomepageIntroGateChange("enabled", event.target.checked)}
                          />
                        }
                        label="เปิดใช้งาน Intro Gate"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="รูปภาพ Intro Gate URL"
                        value={homepageSettings.introGate.imageUrl}
                        onChange={(event) => handleHomepageIntroGateChange("imageUrl", event.target.value)}
                        helperText="ใช้ลิงก์รูปภาพ https:// หรือ Google Drive image URL ที่เผยแพร่ได้"
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="คำอธิบายรูปภาพ alt"
                        value={homepageSettings.introGate.imageAlt}
                        onChange={(event) => handleHomepageIntroGateChange("imageAlt", event.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="ข้อความปุ่มเข้าสู่เว็บไซต์หลัก"
                        value={homepageSettings.introGate.primaryButtonLabel}
                        onChange={(event) => handleHomepageIntroGateChange("primaryButtonLabel", event.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="ข้อความปุ่มลิงก์ภายนอก"
                        value={homepageSettings.introGate.secondaryButtonLabel}
                        onChange={(event) => handleHomepageIntroGateChange("secondaryButtonLabel", event.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="URL ปุ่มลิงก์ภายนอก"
                        value={homepageSettings.introGate.secondaryButtonUrl}
                        onChange={(event) => handleHomepageIntroGateChange("secondaryButtonUrl", event.target.value)}
                        helperText="ใช้ลิงก์ https:// หรือเว้นว่างเพื่อซ่อนปุ่มลิงก์ภายนอก"
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="sessionStorage key"
                        value={homepageSettings.introGate.storageKey}
                        onChange={(event) => handleHomepageIntroGateChange("storageKey", event.target.value)}
                        helperText="เปลี่ยน key เมื่อต้องการให้ผู้ใช้เห็น Intro Gate ใหม่อีกครั้ง"
                        size="small"
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.5 }}>
                    <CampaignOutlinedIcon color="primary" />
                    <Typography variant="h4">Urgent Marquee</Typography>
                  </Stack>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={homepageSettings.marquee.enabled}
                            onChange={(event) => handleHomepageMarqueeChange("enabled", event.target.checked)}
                          />
                        }
                        label="เปิดใช้งานประกาศวิ่ง"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="ป้ายประกาศ"
                        value={homepageSettings.marquee.label}
                        onChange={(event) => handleHomepageMarqueeChange("label", event.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="ความเร็วการวิ่ง วินาที"
                        type="number"
                        value={homepageSettings.marquee.speedSeconds}
                        onChange={(event) => handleHomepageMarqueeChange("speedSeconds", event.target.value)}
                        helperText="ตัวเลขมาก = วิ่งช้าลง แนะนำ 28–40 วินาที"
                        inputProps={{ min: 12, max: 90 }}
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label="ข้อความประกาศ"
                        value={homepageSettings.marquee.text}
                        onChange={(event) => handleHomepageMarqueeChange("text", event.target.value)}
                        multiline
                        minRows={3}
                        size="small"
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.5 }}>
                    <OndemandVideoOutlinedIcon color="primary" />
                    <Typography variant="h4">Intro Video</Typography>
                  </Stack>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={homepageSettings.introVideo.enabled}
                            onChange={(event) => handleHomepageIntroVideoChange("enabled", event.target.checked)}
                          />
                        }
                        label="เปิดใช้งานวิดีโอแนะนำสถานศึกษา"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="หัวข้อวิดีโอ"
                        value={homepageSettings.introVideo.title}
                        onChange={(event) => handleHomepageIntroVideoChange("title", event.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        label="YouTube embed URL"
                        value={homepageSettings.introVideo.youtubeEmbedUrl}
                        onChange={(event) => handleHomepageIntroVideoChange("youtubeEmbedUrl", event.target.value)}
                        helperText="แนะนำให้ใช้ https://www.youtube-nocookie.com/embed/... หรือ YouTube embed URL"
                        size="small"
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Stack>

              <Box sx={{ mt: 2.5 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveOutlinedIcon />}
                  disabled={saveHomepageSettingsMutation.isPending}
                  onClick={() => void handleSaveHomepageSettings()}
                >
                  {saveHomepageSettingsMutation.isPending ? "กำลังบันทึก" : "บันทึกการตั้งค่าหน้าแรก"}
                </Button>
              </Box>
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
                  <Typography color="text.secondary">เซสชันที่เข้าสู่ระบบจะหมดอายุตามค่าระบบโดยอัตโนมัติ</Typography>
                </Box>
                <Box>
                  <Typography fontWeight={900}>การป้องกันรหัสผ่าน</Typography>
                  <Typography color="text.secondary">รหัสผ่านถูกจัดเก็บเป็นแฮชที่ปลอดภัยในชีตผู้ใช้</Typography>
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
