import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import SocialLinkIcon from "../../../shared/components/SocialLinkIcon";
import { saveMediaAsset } from "../../../features/cms-media";
import { buildGoogleDriveThumbnailUrl } from "../../../shared/media/publicImageSources";
import { formatFileSize, readFileAsBase64 } from "../../../utils/files";
import {
  DEFAULT_SOCIAL_WIDGET,
  SOCIAL_ICON_OPTIONS,
  socialHttpsUrl,
  type HomepageSocialLink,
  type HomepageSocialWidgetSettings
} from "../../../features/cms-settings/socialWidget";

interface Props {
  value?: HomepageSocialWidgetSettings;
  disabled: boolean;
  onChange: (next: HomepageSocialWidgetSettings) => void;
}

export default function SocialSettingsEditor({ value, disabled, onChange }: Props) {
  const settings = value ?? DEFAULT_SOCIAL_WIDGET;
  const [uploadingId, setUploadingId] = useState("");
  const [uploadError, setUploadError] = useState("");

  const locked = disabled || Boolean(uploadingId);
  function changeLink(index: number, patch: Partial<HomepageSocialLink>) {
    if (locked) return;
    onChange({ ...settings, links: settings.links.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function addLink() {
    if (locked || settings.links.length >= 100) return;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `social-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    onChange({
      ...settings,
      links: [
        ...settings.links,
        {
          id,
          category: "department",
          label: "",
          href: "",
          iconKey: "facebook",
          iconUrl: "",
          enabled: false
        }
      ]
    });
  }

  function shiftLink(index: number, offset: number) {
    const target = index + offset;
    if (locked || target < 0 || target >= settings.links.length) return;
    const next = [...settings.links];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...settings, links: next });
  }

  async function uploadIcon(index: number, file: File | undefined) {
    if (locked || !file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024 ||
      file.size === 0
    ) {
      setUploadError("รองรับ PNG, JPG, WebP ขนาดไม่เกิน 2 MB เท่านั้น");
      return;
    }
    const link = settings.links[index];
    if (!link) return;
    setUploadError("");
    setUploadingId(link.id);
    try {
      const asset = await saveMediaAsset({
        name: link.label.trim() || file.name,
        type: "image",
        owner: "ผู้ดูแลเว็บไซต์",
        size: formatFileSize(file.size),
        fileName: file.name,
        fileBase64: await readFileAsBase64(file),
        mimeType: file.type
      });
      const candidate = asset.fileId
        ? buildGoogleDriveThumbnailUrl(asset.fileId, 256)
        : asset.thumbnailUrl || asset.previewUrl || asset.driveUrl;
      const iconUrl = socialHttpsUrl(candidate);
      if (!iconUrl) throw new Error("อัปโหลดสำเร็จ แต่ไม่มี URL สำหรับแสดงรูป กรุณาตรวจสอบคลังสื่อ");
      onChange({
        ...settings,
        links: settings.links.map((item) => (item.id === link.id ? { ...item, iconKey: "custom", iconUrl } : item))
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "ไม่สามารถอัปโหลดโลโก้ได้");
    } finally {
      setUploadingId("");
    }
  }

  return (
    <Stack spacing={2.5}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h3">Facebook Page วิทยาลัย</Typography>
            <Alert severity="info">
              URL เพจหลักอยู่ในช่อง Facebook URL ด้านบน ส่วนนี้ฝังเพจทางการบนหน้าแรก หาก Facebook ปิดกั้น iframe
              ผู้ใช้ยังเปิดเพจผ่านลิงก์ได้
            </Alert>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enabled}
                  disabled={locked}
                  onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
                />
              }
              label="เปิดส่วน Facebook และลิงก์หน่วยงานบนหน้าแรก"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.pageEmbedEnabled}
                  disabled={locked}
                  onChange={(event) => onChange({ ...settings, pageEmbedEnabled: event.target.checked })}
                />
              }
              label="แสดง Facebook Page แบบฝัง (Timeline)"
            />
            <TextField
              label="ความสูงของ Facebook Page (px)"
              type="number"
              size="small"
              value={settings.pageEmbedHeight}
              disabled={locked}
              onChange={(event) => {
                const n = Number(event.target.value);
                if (Number.isFinite(n))
                  onChange({
                    ...settings,
                    pageEmbedHeight: Math.min(800, Math.max(300, Math.round(n)))
                  });
              }}
              slotProps={{ htmlInput: { min: 300, max: 800, step: 10 } }}
              helperText="ความกว้างจะปรับอัตโนมัติตามคอลัมน์ (สูง 300–800 px)"
              sx={{ maxWidth: 370 }}
            />
          </Stack>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Box>
                <Typography variant="h3">ลิงก์ Facebook แผนกวิชาและงาน</Typography>
                <Typography variant="body2" color="text.secondary">
                  เลือกไอคอนจากระบบ หรืออัปโหลดโลโก้แต่ละรายการผ่านคลังสื่อเดิม
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={addLink}
                disabled={locked || settings.links.length >= 100}
              >
                เพิ่มลิงก์
              </Button>
            </Stack>
            {uploadError && (
              <Alert severity="error" onClose={() => setUploadError("")}>
                {uploadError}
              </Alert>
            )}
            {settings.links.length === 0 && (
              <Alert severity="info">ยังไม่มีรายการลิงก์ เพิ่มรายการแล้วบันทึกเพื่อนำขึ้นหน้าแรก</Alert>
            )}
            {settings.links.map((link, index) => (
              <Box key={link.id} sx={{ border: "1px solid", borderColor: "divider", p: 2, borderRadius: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <SocialLinkIcon
                      iconKey={link.iconKey}
                      iconUrl={link.iconUrl}
                      label={link.label || "ตัวอย่างไอคอน"}
                    />
                    <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>
                      {link.label || `ลิงก์ใหม่ ${index + 1}`}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={link.enabled}
                          disabled={locked}
                          onChange={(event) => changeLink(index, { enabled: event.target.checked })}
                        />
                      }
                      label="แสดง"
                    />
                  </Stack>
                  <TextField
                    label="ชื่อที่แสดง"
                    size="small"
                    fullWidth
                    value={link.label}
                    disabled={locked}
                    inputProps={{ maxLength: 120 }}
                    onChange={(event) => changeLink(index, { label: event.target.value })}
                  />
                  <TextField
                    label="URL Facebook"
                    size="small"
                    fullWidth
                    value={link.href}
                    disabled={locked}
                    placeholder="https://www.facebook.com/..."
                    onChange={(event) => changeLink(index, { href: event.target.value })}
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      select
                      label="ประเภท"
                      size="small"
                      fullWidth
                      value={link.category}
                      disabled={locked}
                      onChange={(event) =>
                        changeLink(index, { category: event.target.value as HomepageSocialLink["category"] })
                      }
                    >
                      <MenuItem value="department">แผนกวิชา</MenuItem>
                      <MenuItem value="unit">งาน / หน่วยงาน</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="ไอคอน"
                      size="small"
                      fullWidth
                      value={link.iconKey}
                      disabled={locked}
                      onChange={(event) =>
                        changeLink(index, { iconKey: event.target.value as HomepageSocialLink["iconKey"] })
                      }
                    >
                      {SOCIAL_ICON_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  {link.iconKey === "custom" && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<UploadFileOutlinedIcon />}
                        disabled={locked}
                      >
                        {uploadingId === link.id ? "กำลังอัปโหลด..." : "อัปโหลดโลโก้ PNG/JPG/WebP"}
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                          hidden
                          disabled={locked}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            void uploadIcon(index, file);
                          }}
                        />
                      </Button>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                        {link.iconUrl ? "มีโลโก้ที่อัปโหลดแล้ว" : "ยังไม่ได้อัปโหลด (ขนาดสูงสุด 2 MB)"}
                      </Typography>
                    </Stack>
                  )}
                  <Divider />
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      startIcon={<ArrowUpwardIcon />}
                      onClick={() => shiftLink(index, -1)}
                      disabled={locked || index === 0}
                    >
                      ขึ้น
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ArrowDownwardIcon />}
                      onClick={() => shiftLink(index, 1)}
                      disabled={locked || index === settings.links.length - 1}
                    >
                      ลง
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() =>
                        !locked && onChange({ ...settings, links: settings.links.filter((_, i) => i !== index) })
                      }
                      disabled={locked}
                    >
                      ลบรายการ
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
