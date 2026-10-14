import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { HomepageLeadershipSettings, LeadershipDeputy } from "../../../features/cms-settings/types";
import { normalizeLeadershipSettings } from "../../../services/siteSettings";
import { resolvePublicImageSource } from "../../../shared/media/publicImageSources";
import PublicResponsiveImage from "../../../shared/media/PublicResponsiveImage";

const deputyLabels = ["รองผู้อำนวยการ 1", "รองผู้อำนวยการ 2", "รองผู้อำนวยการ 3", "รองผู้อำนวยการ 4"] as const;

interface LeadershipSettingsEditorProps {
  value: HomepageLeadershipSettings | undefined;
  disabled: boolean;
  onChange: (value: HomepageLeadershipSettings) => void;
}

export default function LeadershipSettingsEditor({ value, disabled, onChange }: LeadershipSettingsEditorProps) {
  const settings = normalizeLeadershipSettings(value);
  function changeDeputy(index: number, key: keyof LeadershipDeputy, changed: string | boolean) {
    if (disabled) return;
    onChange({
      ...settings,
      deputies: settings.deputies.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: changed } : item
      )
    });
  }

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Box>
        <Typography variant="h3" sx={{ mb: 0.5 }}>การหมุนเวียนผู้บริหารบนหน้าแรก</Typography>
        <Typography variant="body2" color="text.secondary">
          ระบบใช้ข้อมูลผู้อำนวยการด้านบนเป็นลำดับแรก แล้วแสดงรองผู้อำนวยการที่เปิดใช้งานตามลำดับ 1–4
          หากมีเพียงผู้อำนวยการ ระบบจะแสดงภาพคงที่เช่นเดิม
        </Typography>
      </Box>
      <TextField
        label="ระยะเวลาเปลี่ยนผู้บริหาร (วินาที)"
        type="number"
        size="small"
        disabled={disabled}
        value={settings.autoplayIntervalSeconds}
        onChange={(event) => {
          const input = Number(event.target.value);
          if (!Number.isFinite(input)) return;
          onChange({ ...settings, autoplayIntervalSeconds: Math.min(30, Math.max(3, Math.round(input))) });
        }}
        slotProps={{ htmlInput: { min: 3, max: 30, step: 1 } }}
        helperText="ค่าปกติ 6 วินาที; ตั้งได้ตั้งแต่ 3 ถึง 30 วินาที"
        sx={{ maxWidth: 360 }}
      />
      <Grid container spacing={2}>
        {settings.deputies.map((deputy, index) => {
          const previewUrl = resolvePublicImageSource(deputy.imageUrl, "portrait").src;
          return (
            <Grid key={index} size={{ xs: 12, lg: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{deputyLabels[index]}</Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={deputy.enabled}
                            disabled={disabled}
                            onChange={(event) => changeDeputy(index, "enabled", event.target.checked)}
                          />
                        }
                        label="แสดงบนหน้าแรก"
                      />
                    </Stack>
                    <TextField
                      label="ชื่อ–นามสกุล"
                      size="small"
                      fullWidth
                      disabled={disabled}
                      required={deputy.enabled}
                      value={deputy.name}
                      onChange={(event) => changeDeputy(index, "name", event.target.value)}
                      helperText={deputy.enabled && !deputy.name.trim() ? "กรุณากรอกชื่อก่อนบันทึกตำแหน่งที่เปิดใช้งาน" : undefined}
                      error={deputy.enabled && !deputy.name.trim()}
                    />
                    <TextField
                      label="ตำแหน่ง"
                      size="small"
                      fullWidth
                      disabled={disabled}
                      value={deputy.title}
                      onChange={(event) => changeDeputy(index, "title", event.target.value)}
                    />
                    <TextField
                      label="คำอธิบาย (ไม่บังคับ)"
                      size="small"
                      fullWidth
                      disabled={disabled}
                      multiline
                      minRows={2}
                      value={deputy.description}
                      onChange={(event) => changeDeputy(index, "description", event.target.value)}
                    />
                    <TextField
                      label="URL รูปภาพผู้บริหาร"
                      size="small"
                      fullWidth
                      disabled={disabled}
                      value={deputy.imageUrl}
                      onChange={(event) => changeDeputy(index, "imageUrl", event.target.value)}
                      helperText="รองรับ https:// และลิงก์แชร์ Google Drive; เว้นว่างได้เพื่อใช้ภาพสำรอง"
                    />
                    {previewUrl && (
                      <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <PublicResponsiveImage
                          source={deputy.imageUrl}
                          intent="portrait"
                          bypassPageMediaGate
                          alt={`ภาพตัวอย่าง ${deputy.name || deputyLabels[index]}`}
                          loadMode="eager"
                          aspectRatio="3 / 4"
                          fill
                          sx={{ width: 120, bgcolor: "background.default", borderRadius: 1, overflow: "hidden" }}
                          imageSx={{ objectFit: "cover", objectPosition: "center top" }}
                        />
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}
