import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
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
import Grid from "@mui/material/Grid";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import PageHeader from "../components/PageHeader";
import { staticSurfaceSx } from "../../design-system/componentStyles";
import { useAuth } from "../../context/authSessionContext";
import { projectSettings } from "../../config/projectSettings";
import {
  dateFormatPresets,
  defaultDisplaySettings,
  loadDisplaySettings,
  normalizeDisplaySettings,
  saveDisplaySettings
} from "../../services/displaySettings";
import { normalizeHomepageSettings } from "../../services/homepageSettings";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { defaultSiteSettings, normalizeSiteSettings } from "../../services/siteSettings";
import { normalizeVisitorStats } from "../../services/visitorStats";
import {
  getHomepageSettingsFromApi,
  getSiteSettingsFromApi,
  saveHomepageSettingsToApi,
  saveSiteSettingsToApi,
  saveVisitorStatsToApi
} from "../../features/cms-settings";
import { adminVisitorStatsSummaryQueryOptions } from "../../features/admin-pagination";
import {
  DisplaySettings,
  FooterDirectoryLink,
  HomepageSettings,
  SiteSettings,
  VisitorStatsSettings
} from "../../types";
import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from "../../utils/dateDisplay";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { ADMIN_READ_ONLY_NOTICE, canManageAdminData } from "../utils/rbac";

function toNonNegativeInteger(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function extractIframeSrcForValidation(value: string) {
  const input = String(value || "").trim();

  if (!/<iframe\b/i.test(input)) {
    return input;
  }

  const srcMatch = input.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);

  return srcMatch ? srcMatch[2].replace(/&amp;/gi, "&") : "";
}

function isProbablyGoogleMapsUrl(value: string) {
  const input = value.trim();

  if (!input) {
    return true;
  }

  try {
    const parsed = new URL(input);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:") {
      return false;
    }

    if (hostname === "maps.app.goo.gl") {
      return true;
    }

    return (
      (hostname === "www.google.com" || hostname === "google.com" || hostname === "maps.google.com") &&
      parsed.pathname.startsWith("/maps")
    );
  } catch {
    return false;
  }
}

function isProbablyGoogleMapsEmbedUrl(value: string) {
  const input = extractIframeSrcForValidation(value);

  if (!input) {
    return true;
  }

  try {
    const parsed = new URL(input);

    return (
      parsed.protocol === "https:" &&
      parsed.hostname.toLowerCase() === "www.google.com" &&
      parsed.pathname === "/maps/embed"
    );
  } catch {
    return false;
  }
}

function getSiteSettingsValidationMessage(settings: SiteSettings): { title: string; text: string } | null {
  const messengerUrl = settings.messengerUrl.trim();
  const mapUrl = settings.mapUrl.trim();
  const mapEmbedUrl = settings.mapEmbedUrl.trim();

  if (messengerUrl.toLowerCase().includes("example.com")) {
    return {
      title: "ไม่ควรใช้ลิงก์ตัวอย่าง",
      text: "กรุณาใช้ Messenger URL จริง หรือเว้นว่างเพื่อซ่อนปุ่ม"
    };
  }

  if (settings.messengerEnabled && (!messengerUrl || messengerUrl === "#")) {
    return {
      title: "กรุณากรอก Messenger URL",
      text: "เมื่อเปิดใช้งานปุ่ม Messenger ต้องระบุ URL จริง เช่น https://m.me/yourpage"
    };
  }

  if (mapUrl === "#") {
    return {
      title: "ไม่ควรใช้ลิงก์ #",
      text: "กรุณาใช้ลิงก์ Google Maps จริงของสถานศึกษา หรือเว้นว่างเพื่อซ่อนปุ่มแผนที่"
    };
  }

  if (mapUrl.toLowerCase().includes("example.com")) {
    return {
      title: "ไม่ควรใช้ลิงก์ตัวอย่าง",
      text: "กรุณาใช้ลิงก์ Google Maps จริงของสถานศึกษา"
    };
  }

  if (mapUrl && !isProbablyGoogleMapsUrl(mapUrl)) {
    return {
      title: "ลิงก์ Google Maps ไม่ถูกต้อง",
      text: "กรุณาใช้ลิงก์ Google Maps เช่น https://maps.app.goo.gl/... หรือ https://www.google.com/maps/..."
    };
  }

  if (mapEmbedUrl.toLowerCase().includes("example.com")) {
    return {
      title: "ไม่ควรใช้ลิงก์ตัวอย่าง",
      text: "กรุณาใช้ Google Maps Embed URL จริง หรือโค้ด iframe จาก Google Maps"
    };
  }

  if (mapEmbedUrl && !isProbablyGoogleMapsEmbedUrl(mapEmbedUrl)) {
    return {
      title: "ลิงก์ Google Maps Embed ไม่ถูกต้อง",
      text: "กรุณาใช้ https://www.google.com/maps/embed... หรือวางโค้ด iframe จาก Google Maps"
    };
  }

  for (const group of settings.footerDirectoryGroups) {
    for (const link of group.links) {
      const href = link.href.trim();

      if (href === "#") {
        return {
          title: "ไม่ควรใช้ลิงก์ #",
          text: "กรุณาใช้ URL จริงหรือลบลิงก์ที่ยังไม่พร้อมออกจากส่วนท้ายเว็บไซต์"
        };
      }

      if (href.toLowerCase().includes("example.com")) {
        return {
          title: "ไม่ควรใช้ลิงก์ตัวอย่าง",
          text: "กรุณาใช้ URL จริงสำหรับลิงก์ส่วนท้ายเว็บไซต์"
        };
      }

      if (link.enabled && (!link.label.trim() || !href)) {
        return {
          title: "กรุณากรอกข้อมูลลิงก์ให้ครบ",
          text: "ลิงก์ส่วนท้ายที่เปิดใช้งานต้องมีทั้งชื่อและ URL"
        };
      }
    }
  }

  return null;
}

type SiteSettingTextKey = Exclude<
  keyof SiteSettings,
  | "footerDirectoryGroups"
  | "messengerEnabled"
  | "messengerUrl"
  | "messengerLabel"
  | "mourningModeEnabled"
  | "mourningModeLabel"
  | "mourningModeNotice"
>;

const siteSettingFields: Array<{
  key: SiteSettingTextKey;
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
    helperText:
      "ลิงก์เปิด Google Maps จริงของสถานศึกษา เช่น https://maps.app.goo.gl/... หรือเว้นว่างเพื่อไม่แสดงปุ่มแผนที่"
  },
  {
    key: "mapEmbedUrl",
    label: "Google Maps Embed URL",
    helperText: "วางลิงก์ Google Maps Embed หรือโค้ด iframe จาก Google Maps ได้ หากเว้นว่าง ระบบจะไม่แสดงแผนที่ฝัง"
  },
  { key: "footerTitle", label: "หัวข้อท้ายเว็บ" },
  { key: "footerDescription", label: "คำอธิบายท้ายเว็บ", multiline: true }
];

const visitorStatsFields: Array<{
  key: Exclude<keyof VisitorStatsSettings, "enabled" | "updatedAt">;
  label: string;
}> = [
  { key: "usersToday", label: "Users Today" },
  { key: "usersYesterday", label: "Users Yesterday" },
  { key: "usersThisMonth", label: "Users This Month" },
  { key: "usersThisYear", label: "Users This Year" },
  { key: "totalUsers", label: "Total Users" },
  { key: "totalViews", label: "Total views" },
  { key: "onlineUsers", label: "Who's Online" }
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { capabilities } = useAuth();
  const canManage = canManageAdminData(capabilities);
  const rolePermissions = projectSettings.roles;
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(defaultDisplaySettings);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [homepageSettings, setHomepageSettings] = useState<HomepageSettings>(normalizeHomepageSettings());
  const [visitorStats, setVisitorStats] = useState<VisitorStatsSettings>(normalizeVisitorStats());
  const [displaySettingsSource, setDisplaySettingsSource] = useState<DisplaySettings | undefined>();
  const [siteSettingsSource, setSiteSettingsSource] = useState<SiteSettings | undefined>();
  const [homepageSettingsSource, setHomepageSettingsSource] = useState<HomepageSettings | undefined>();
  const [visitorStatsSource, setVisitorStatsSource] = useState<VisitorStatsSettings | undefined>();

  const displaySettingsQuery = useQuery({
    queryKey: ["admin-settings", "display"],
    queryFn: loadDisplaySettings
  });
  const siteSettingsQuery = useQuery({
    queryKey: ["admin-settings", "site"],
    queryFn: getSiteSettingsFromApi
  });
  const homepageSettingsQuery = useQuery({
    queryKey: ["admin-settings", "homepage"],
    queryFn: getHomepageSettingsFromApi
  });
  const visitorStatsQuery = useQuery(adminVisitorStatsSummaryQueryOptions());

  const saveDisplaySettingsMutation = useMutation({
    mutationFn: saveDisplaySettings
  });
  const saveSiteSettingsMutation = useMutation({
    mutationFn: saveSiteSettingsToApi
  });
  const saveHomepageSettingsMutation = useMutation({
    mutationFn: saveHomepageSettingsToApi
  });
  const saveVisitorStatsMutation = useMutation({
    mutationFn: saveVisitorStatsToApi
  });

  if (displaySettingsQuery.data && displaySettingsSource !== displaySettingsQuery.data) {
    setDisplaySettingsSource(displaySettingsQuery.data);
    setDisplaySettings(normalizeDisplaySettings(displaySettingsQuery.data));
  }

  if (siteSettingsQuery.data && siteSettingsSource !== siteSettingsQuery.data) {
    setSiteSettingsSource(siteSettingsQuery.data);
    setSiteSettings(normalizeSiteSettings(siteSettingsQuery.data));
  }

  if (homepageSettingsQuery.data && homepageSettingsSource !== homepageSettingsQuery.data) {
    setHomepageSettingsSource(homepageSettingsQuery.data);
    setHomepageSettings(normalizeHomepageSettings(homepageSettingsQuery.data));
  }

  if (visitorStatsQuery.data && visitorStatsSource !== visitorStatsQuery.data) {
    setVisitorStatsSource(visitorStatsQuery.data);
    setVisitorStats(normalizeVisitorStats(visitorStatsQuery.data));
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
    if (!canManage) {
      return;
    }

    showBlockingLoading("กำลังบันทึกการแสดงผล");

    try {
      const nextSettings = normalizeDisplaySettings(displaySettings);
      const saved = await saveDisplaySettingsMutation.mutateAsync(nextSettings);
      setDisplaySettings(normalizeDisplaySettings(saved));
      await appSwal.close();
      await showSuccessResult("บันทึกการแสดงผลแล้ว", "รูปแบบวันที่และเวลาได้รับการอัปเดตสำหรับ CMS นี้");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกการแสดงผลได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  function handleSiteSettingsChange(
    key: SiteSettingTextKey | "messengerUrl" | "messengerLabel" | "mourningModeLabel" | "mourningModeNotice",
    value: string
  ) {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleMessengerEnabledChange(value: boolean) {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      messengerEnabled: value
    }));
  }

  function handleMourningModeEnabledChange(value: boolean) {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      mourningModeEnabled: value
    }));
  }

  function handleFooterGroupTitleChange(groupIndex: number, value: string) {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      footerDirectoryGroups: current.footerDirectoryGroups.map((group, index) =>
        index === groupIndex ? { ...group, title: value } : group
      )
    }));
  }

  function handleAddFooterGroup() {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      footerDirectoryGroups: [
        ...current.footerDirectoryGroups,
        {
          title: "",
          links: []
        }
      ]
    }));
  }

  function handleRemoveFooterGroup(groupIndex: number) {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      footerDirectoryGroups: current.footerDirectoryGroups.filter((_, index) => index !== groupIndex)
    }));
  }

  function handleAddFooterLink(groupIndex: number) {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      footerDirectoryGroups: current.footerDirectoryGroups.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              links: [
                ...group.links,
                {
                  label: "",
                  href: "",
                  enabled: true
                }
              ]
            }
          : group
      )
    }));
  }

  function handleRemoveFooterLink(groupIndex: number, linkIndex: number) {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      footerDirectoryGroups: current.footerDirectoryGroups.map((group, index) =>
        index === groupIndex
          ? { ...group, links: group.links.filter((_, childIndex) => childIndex !== linkIndex) }
          : group
      )
    }));
  }

  function handleFooterLinkChange(
    groupIndex: number,
    linkIndex: number,
    key: keyof FooterDirectoryLink,
    value: string | boolean
  ) {
    if (!canManage) {
      return;
    }

    setSiteSettings((current) => ({
      ...current,
      footerDirectoryGroups: current.footerDirectoryGroups.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              links: group.links.map((link, childIndex) =>
                childIndex === linkIndex
                  ? {
                      ...link,
                      [key]: value
                    }
                  : link
              )
            }
          : group
      )
    }));
  }

  function handleHomepageIntroGateChange(key: keyof HomepageSettings["introGate"], value: string | boolean) {
    if (!canManage) {
      return;
    }

    setHomepageSettings((current) => ({
      ...current,
      introGate: {
        ...current.introGate,
        [key]: value
      }
    }));
  }

  function handleHomepageMarqueeChange(key: keyof HomepageSettings["marquee"], value: string | boolean | number) {
    if (!canManage) {
      return;
    }

    const nextValue = key === "speedSeconds" ? Math.min(180, Math.max(24, Number(value) || 60)) : value;

    setHomepageSettings((current) => ({
      ...current,
      marquee: {
        ...current.marquee,
        [key]: nextValue
      }
    }));
  }

  function handleHomepageIntroVideoChange(key: keyof HomepageSettings["introVideo"], value: string | boolean) {
    if (!canManage) {
      return;
    }

    setHomepageSettings((current) => ({
      ...current,
      introVideo: {
        ...current.introVideo,
        [key]: value
      }
    }));
  }

  function handleVisitorStatsChange(key: keyof VisitorStatsSettings, value: number | boolean) {
    if (!canManage) {
      return;
    }

    setVisitorStats((current) => ({
      ...current,
      [key]: typeof value === "number" ? toNonNegativeInteger(value) : value
    }));
  }

  async function handleSaveSiteSettings() {
    if (!canManage) {
      return;
    }

    const validationMessage = getSiteSettingsValidationMessage(siteSettings);

    if (validationMessage) {
      await appSwal.fire({
        icon: "warning",
        title: validationMessage.title,
        text: validationMessage.text,
        confirmButtonText: "ตกลง"
      });
      return;
    }

    showBlockingLoading("กำลังบันทึกข้อมูลเว็บไซต์สาธารณะ");

    try {
      const saved = await saveSiteSettingsMutation.mutateAsync(normalizeSiteSettings(siteSettings));
      setSiteSettings(normalizeSiteSettings(saved));
      await Promise.all([
        invalidatePublicCmsData(queryClient),
        queryClient.invalidateQueries({ queryKey: ["admin-settings", "site"] })
      ]);
      await appSwal.close();
      await showSuccessResult("บันทึกข้อมูลเว็บไซต์สาธารณะแล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกข้อมูลเว็บไซต์สาธารณะได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  async function handleSaveHomepageSettings() {
    if (!canManage) {
      return;
    }

    showBlockingLoading("กำลังบันทึกการตั้งค่าหน้าแรก");

    try {
      const nextSettings = normalizeHomepageSettings(homepageSettings);
      const saved = await saveHomepageSettingsMutation.mutateAsync(nextSettings);
      setHomepageSettings(normalizeHomepageSettings(saved));
      await Promise.all([
        invalidatePublicCmsData(queryClient),
        queryClient.invalidateQueries({ queryKey: ["admin-settings", "homepage"] })
      ]);
      await appSwal.close();
      await showSuccessResult("บันทึกการตั้งค่าหน้าแรกแล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกการตั้งค่าหน้าแรกได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  async function handleSaveVisitorStats() {
    if (!canManage) {
      return;
    }

    showBlockingLoading("กำลังบันทึกสถิติผู้เข้าชม");

    try {
      const nextStats = normalizeVisitorStats({
        enabled: visitorStats.enabled
      });
      const saved = await saveVisitorStatsMutation.mutateAsync(nextStats);
      setVisitorStats(normalizeVisitorStats(saved));
      await Promise.all([
        invalidatePublicCmsData(queryClient),
        queryClient.invalidateQueries({ queryKey: ["admin-visitor-stats-summary"] })
      ]);
      await appSwal.close();
      await showSuccessResult("บันทึกสถิติผู้เข้าชมแล้ว");
    } catch (error) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถบันทึกสถิติผู้เข้าชมได้", error, "กรุณาลองอีกครั้ง");
    }
  }

  return (
    <Box>
      <PageHeader title="ตั้งค่า" description="สิทธิ์การเผยแพร่ การจัดการผู้ใช้ และรูปแบบการแสดงผล" />
      {!canManage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  mb: 2
                }}
              >
                <AccessTimeOutlinedIcon color="primary" />
                <Typography variant="h3">การแสดงวันที่และเวลา</Typography>
              </Stack>
              <Typography
                sx={{
                  color: "text.secondary",
                  mb: 2
                }}
              >
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
                      onChange={() =>
                        setDisplaySettings((current) => ({
                          ...current,
                          timeMode: "24h"
                        }))
                      }
                    >
                      <MenuItem value="24h">24 ชั่วโมง (14:30)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    disabled={!canManage || saveDisplaySettingsMutation.isPending}
                    onClick={() => void handleSaveDisplaySettings()}
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
                  borderColor: "divider",
                  bgcolor: "background.default"
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                    ตัวอย่าง
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Typography
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      วันที่: {previewDate.date}
                    </Typography>
                    <Typography
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      เวลา: {previewDate.time}
                    </Typography>
                    <Typography
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      วันที่และเวลา: {previewDate.dateTime}
                    </Typography>
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
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  mb: 2
                }}
              >
                <LanguageOutlinedIcon color="primary" />
                <Typography variant="h3">ข้อมูลเว็บไซต์สาธารณะ</Typography>
              </Stack>
              <Typography
                sx={{
                  color: "text.secondary",
                  mb: 2
                }}
              >
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
                    {field.key === "mapEmbedUrl" && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: "warning.dark",
                          display: "block",
                          mt: 0.6
                        }}
                      >
                        ตรวจสอบพิกัดให้ถูกต้องก่อนบันทึก เพราะข้อมูลนี้แสดงต่อผู้ใช้เว็บไซต์สาธารณะ
                      </Typography>
                    )}
                  </Grid>
                ))}
                <Grid size={{ xs: 12 }}>
                  <Card variant="outlined" sx={{ bgcolor: "grey.50", borderColor: "grey.300" }}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Box>
                          <Typography
                            sx={{
                              fontWeight: 900
                            }}
                          >
                            โหมดไว้อาลัย / Black-white theme
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "text.secondary",
                              mt: 0.5
                            }}
                          >
                            เมื่อเปิดใช้งาน เว็บไซต์สาธารณะจะแสดงผลแบบขาวดำเพื่อการไว้อาลัย
                          </Typography>
                        </Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={siteSettings.mourningModeEnabled}
                              onChange={(event) => handleMourningModeEnabledChange(event.target.checked)}
                            />
                          }
                          label="เปิดโหมดไว้อาลัย"
                        />
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 12, md: 5 }}>
                            <TextField
                              label="ชื่อโหมดไว้อาลัย"
                              value={siteSettings.mourningModeLabel}
                              onChange={(event) => handleSiteSettingsChange("mourningModeLabel", event.target.value)}
                              size="small"
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 7 }}>
                            <TextField
                              label="ข้อความประกาศโหมดไว้อาลัย"
                              value={siteSettings.mourningModeNotice}
                              onChange={(event) => handleSiteSettingsChange("mourningModeNotice", event.target.value)}
                              size="small"
                              fullWidth
                            />
                          </Grid>
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 1 }} />
                  <Stack spacing={1}>
                    <Typography
                      sx={{
                        fontWeight: 900
                      }}
                    >
                      ลิงก์ส่วนท้ายเว็บไซต์และ Messenger
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary"
                      }}
                    >
                      จัดการไดเรกทอรีลิงก์ส่วนท้ายเว็บไซต์และปุ่มแชท Messenger ที่แสดงบนเว็บไซต์สาธารณะ
                    </Typography>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={siteSettings.messengerEnabled}
                        onChange={(event) => handleMessengerEnabledChange(event.target.checked)}
                      />
                    }
                    label="เปิดใช้งานปุ่ม Messenger"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="ข้อความปุ่ม Messenger"
                    value={siteSettings.messengerLabel}
                    onChange={(event) => handleSiteSettingsChange("messengerLabel", event.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Messenger URL"
                    value={siteSettings.messengerUrl}
                    onChange={(event) => handleSiteSettingsChange("messengerUrl", event.target.value)}
                    helperText="เช่น https://m.me/yourpage หรือเว้นว่างเพื่อซ่อนปุ่ม"
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{
                        alignItems: { sm: "center" }
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 900,
                          flex: 1
                        }}
                      >
                        ไดเรกทอรีลิงก์ส่วนท้ายเว็บไซต์
                      </Typography>
                      <Button variant="outlined" disabled={!canManage} onClick={handleAddFooterGroup}>
                        เพิ่มกลุ่มลิงก์
                      </Button>
                    </Stack>
                    {siteSettings.footerDirectoryGroups.length === 0 && (
                      <Box
                        sx={{
                          ...staticSurfaceSx,
                          borderStyle: "dashed",
                          p: 2,
                          bgcolor: "background.default"
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary"
                          }}
                        >
                          ยังไม่มีกลุ่มลิงก์ ส่วนท้ายเว็บไซต์จะไม่แสดงไดเรกทอรีลิงก์จนกว่าจะเพิ่มลิงก์ที่เปิดใช้งาน
                        </Typography>
                      </Box>
                    )}
                    {siteSettings.footerDirectoryGroups.map((group, groupIndex) => (
                      <Box
                        key={`footer-group-${groupIndex}`}
                        sx={{
                          ...staticSurfaceSx,
                          p: 1.5,
                          bgcolor: "background.default"
                        }}
                      >
                        <Stack spacing={1.25}>
                          <Grid
                            container
                            spacing={1.2}
                            sx={{
                              alignItems: "center"
                            }}
                          >
                            <Grid size={{ xs: 12, md: 8 }}>
                              <TextField
                                label="ชื่อกลุ่มลิงก์"
                                value={group.title}
                                onChange={(event) => handleFooterGroupTitleChange(groupIndex, event.target.value)}
                                size="small"
                                fullWidth
                              />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{
                                  justifyContent: { md: "flex-end" }
                                }}
                              >
                                <Button
                                  variant="outlined"
                                  disabled={!canManage}
                                  onClick={() => handleAddFooterLink(groupIndex)}
                                >
                                  เพิ่มลิงก์
                                </Button>
                                <Button
                                  color="error"
                                  variant="outlined"
                                  disabled={!canManage}
                                  onClick={() => handleRemoveFooterGroup(groupIndex)}
                                >
                                  ลบกลุ่ม
                                </Button>
                              </Stack>
                            </Grid>
                          </Grid>
                          {group.links.map((link, linkIndex) => (
                            <Grid
                              container
                              spacing={1}
                              key={`footer-link-${groupIndex}-${linkIndex}`}
                              sx={{
                                alignItems: "center"
                              }}
                            >
                              <Grid size={{ xs: 12, md: 3 }}>
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={link.enabled}
                                      onChange={(event) =>
                                        handleFooterLinkChange(groupIndex, linkIndex, "enabled", event.target.checked)
                                      }
                                    />
                                  }
                                  label="เปิดใช้งาน"
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                  label="ชื่อลิงก์"
                                  value={link.label}
                                  onChange={(event) =>
                                    handleFooterLinkChange(groupIndex, linkIndex, "label", event.target.value)
                                  }
                                  size="small"
                                  fullWidth
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                  label="URL"
                                  value={link.href}
                                  onChange={(event) =>
                                    handleFooterLinkChange(groupIndex, linkIndex, "href", event.target.value)
                                  }
                                  helperText="ใช้ /internal-path หรือ https:// และห้ามใช้ #"
                                  size="small"
                                  fullWidth
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 2 }}>
                                <Button
                                  color="error"
                                  variant="outlined"
                                  disabled={!canManage}
                                  onClick={() => handleRemoveFooterLink(groupIndex, linkIndex)}
                                  fullWidth
                                >
                                  ลบลิงก์
                                </Button>
                              </Grid>
                            </Grid>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    disabled={!canManage || saveSiteSettingsMutation.isPending}
                    onClick={() => void handleSaveSiteSettings()}
                  >
                    {saveSiteSettingsMutation.isPending ? "กำลังบันทึก" : "บันทึกข้อมูลเว็บไซต์"}
                  </Button>
                  {siteSettingsQuery.isError && (
                    <Typography color="error" variant="body2" sx={{ mt: 1.2 }}>
                      {siteSettingsQuery.error instanceof Error
                        ? siteSettingsQuery.error.message
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
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  mb: 2
                }}
              >
                <CampaignOutlinedIcon color="primary" />
                <Typography variant="h3">การตั้งค่าหน้าแรก</Typography>
              </Stack>
              <Typography
                sx={{
                  color: "text.secondary",
                  mb: 2
                }}
              >
                ควบคุมส่วน Intro Gate, ประกาศวิ่ง และวิดีโอแนะนำสถานศึกษาที่แสดงในหน้าเว็บไซต์สาธารณะ
              </Typography>

              {homepageSettingsQuery.isError && (
                <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                  ไม่สามารถโหลดการตั้งค่าหน้าแรกได้
                </Typography>
              )}

              <Stack spacing={2.4} divider={<Divider flexItem />}>
                <Box>
                  <Stack
                    direction="row"
                    spacing={1.2}
                    sx={{
                      alignItems: "center",
                      mb: 1.5
                    }}
                  >
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
                        helperText={
                          <Stack component="span" spacing={0.35}>
                            <Box component="span">
                              แนะนำให้อัปโหลดรูปไปยังสื่อของเว็บไซต์, ใช้ path คงที่เช่น /intro/intro-gate-2026.webp,
                              ใช้ Google Drive share link ที่ตั้งค่า Anyone with the link, หรือใช้ CDN/storage
                              ที่เป็นของเรา
                            </Box>
                            <Box component="span" sx={{ color: "warning.main", fontWeight: 800 }}>
                              ห้ามใช้ลิงก์ Facebook CDN โดยตรง เช่น scontent...fbcdn.net เพราะเป็นลิงก์ชั่วคราว
                              และอาจไม่แสดงบนมือถือ
                            </Box>
                          </Stack>
                        }
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
                  <Stack
                    direction="row"
                    spacing={1.2}
                    sx={{
                      alignItems: "center",
                      mb: 1.5
                    }}
                  >
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
                        helperText="ตัวเลขมาก = วิ่งช้าลง แนะนำ 60–90 วินาทีสำหรับสไตล์หน่วยงานที่นิ่งและอ่านง่าย"
                        slotProps={{ htmlInput: { min: 24, max: 180 } }}
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
                  <Stack
                    direction="row"
                    spacing={1.2}
                    sx={{
                      alignItems: "center",
                      mb: 1.5
                    }}
                  >
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
                  disabled={!canManage || saveHomepageSettingsMutation.isPending}
                  onClick={() => void handleSaveHomepageSettings()}
                >
                  {saveHomepageSettingsMutation.isPending ? "กำลังบันทึก" : "บันทึกการตั้งค่าหน้าแรก"}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  mb: 2
                }}
              >
                <PeopleAltOutlinedIcon color="primary" />
                <Typography variant="h3">สถิติผู้เข้าชมเว็บไซต์</Typography>
              </Stack>
              <Typography
                sx={{
                  color: "text.secondary",
                  mb: 1
                }}
              >
                ควบคุมตัวเลขสถิติผู้เข้าชมที่แสดงในหน้าเว็บไซต์สาธารณะ
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mb: 2
                }}
              >
                ตัวเลขสถิติถูกนับอัตโนมัติจากหน้าเว็บสาธารณะ ผู้ดูแลสามารถเปิดหรือปิดการแสดงผลได้เท่านั้น
              </Typography>

              {visitorStatsQuery.isError && (
                <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                  ไม่สามารถโหลดสถิติผู้เข้าชมได้
                </Typography>
              )}

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={visitorStats.enabled}
                        onChange={(event) => handleVisitorStatsChange("enabled", event.target.checked)}
                      />
                    }
                    label="เปิดใช้งานสถิติผู้เข้าชม"
                  />
                </Grid>
                {visitorStatsFields.map((field) => (
                  <Grid key={field.key} size={{ xs: 12, sm: 6, md: 4 }}>
                    <TextField
                      label={field.label}
                      type="number"
                      value={visitorStats[field.key]}
                      slotProps={{
                        htmlInput: { min: 0, step: 1 },
                        input: { readOnly: true }
                      }}
                      size="small"
                      fullWidth
                    />
                  </Grid>
                ))}
                <Grid size={{ xs: 12 }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    disabled={!canManage || saveVisitorStatsMutation.isPending}
                    onClick={() => void handleSaveVisitorStats()}
                  >
                    {saveVisitorStatsMutation.isPending ? "กำลังบันทึก" : "บันทึกการแสดงผลสถิติผู้เข้าชม"}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  mb: 2
                }}
              >
                <ShieldOutlinedIcon color="primary" />
                <Typography variant="h3">บทบาท</Typography>
              </Stack>
              <Stack spacing={1.5}>
                {rolePermissions.map((role) => (
                  <Stack
                    key={role.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{
                      justifyContent: "space-between",
                      ...staticSurfaceSx,
                      p: 2
                    }}
                  >
                    <Box>
                      <Typography
                        sx={{
                          fontWeight: 900
                        }}
                      >
                        {role.role}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary"
                        }}
                      >
                        {role.scope}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: "center"
                        }}
                      >
                        <Checkbox checked={role.canPublish} readOnly />
                        <Typography variant="body2">เผยแพร่</Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: "center"
                        }}
                      >
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
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  mb: 2
                }}
              >
                <KeyOutlinedIcon color="secondary" />
                <Typography variant="h3">ความปลอดภัย</Typography>
              </Stack>
              <Stack spacing={2}>
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 900
                    }}
                  >
                    ระยะเวลาเซสชัน
                  </Typography>
                  <Typography
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    เซสชันที่เข้าสู่ระบบจะหมดอายุตามค่าระบบโดยอัตโนมัติ
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 900
                    }}
                  >
                    การป้องกันรหัสผ่าน
                  </Typography>
                  <Typography
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    รหัสผ่านถูกจัดเก็บเป็นแฮชที่ปลอดภัยในชีตผู้ใช้
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 900
                    }}
                  >
                    การตั้งค่าการ deploy
                  </Typography>
                  <Typography
                    sx={{
                      color: "text.secondary"
                    }}
                  >
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
