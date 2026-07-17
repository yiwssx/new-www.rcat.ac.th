import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import type { HomepageCarouselSettings } from "../../types";

interface CarouselGlobalSettingsEditorProps {
  settings: HomepageCarouselSettings;
  disabled: boolean;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  onChange: <K extends keyof HomepageCarouselSettings>(key: K, value: HomepageCarouselSettings[K]) => void;
  onReset: () => void;
  onSave: () => void;
}

export default function CarouselGlobalSettingsEditor({
  settings,
  disabled,
  loading,
  saving,
  dirty,
  onChange,
  onReset,
  onSave
}: CarouselGlobalSettingsEditorProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h3" sx={{ fontSize: "1.12rem" }}>
                การทำงานของสไลด์หน้าแรก
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                ตั้งค่า autoplay, ปุ่มควบคุม การหยุดชั่วคราว และรูปแบบการเปลี่ยนภาพ
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} justifyContent={{ xs: "stretch", sm: "flex-end" }}>
              <Button
                color="inherit"
                variant="outlined"
                startIcon={<RestartAltOutlinedIcon />}
                disabled={disabled || loading || saving || !dirty}
                onClick={onReset}
              >
                คืนค่า
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveOutlinedIcon />}
                disabled={disabled || loading || saving || !dirty}
                onClick={onSave}
              >
                {saving ? "กำลังบันทึก" : "บันทึกการตั้งค่า"}
              </Button>
            </Stack>
          </Stack>

          {dirty && <Alert severity="info">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoplayEnabled}
                      onChange={(event) => onChange("autoplayEnabled", event.target.checked)}
                      disabled={disabled}
                    />
                  }
                  label="เปิดเล่นสไลด์อัตโนมัติ"
                />
                <TextField
                  label="ระยะเวลาเปลี่ยนภาพ (วินาที)"
                  type="number"
                  value={settings.autoplayIntervalSeconds}
                  onChange={(event) => onChange("autoplayIntervalSeconds", Number(event.target.value))}
                  helperText="กำหนดได้ตั้งแต่ 3 ถึง 30 วินาที"
                  slotProps={{ htmlInput: { min: 3, max: 30, step: 1 } }}
                  size="small"
                  disabled={disabled}
                  fullWidth
                />
                <FormControl fullWidth size="small" disabled={disabled}>
                  <InputLabel id="carousel-transition-label">รูปแบบการเปลี่ยนภาพ</InputLabel>
                  <Select
                    labelId="carousel-transition-label"
                    label="รูปแบบการเปลี่ยนภาพ"
                    value={settings.transition}
                    onChange={(event) =>
                      onChange("transition", event.target.value as HomepageCarouselSettings["transition"])
                    }
                  >
                    <MenuItem value="slide">เลื่อนด้านข้าง (Slide)</MenuItem>
                    <MenuItem value="fade">จางซ้อน (Fade)</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.showArrows}
                      onChange={(event) => onChange("showArrows", event.target.checked)}
                      disabled={disabled}
                    />
                  }
                  label="แสดงปุ่มลูกศร"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.showDots}
                      onChange={(event) => onChange("showDots", event.target.checked)}
                      disabled={disabled}
                    />
                  }
                  label="แสดงจุดนำทาง"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.pauseOnHover}
                      onChange={(event) => onChange("pauseOnHover", event.target.checked)}
                      disabled={disabled}
                    />
                  }
                  label="หยุดเมื่อวางเมาส์"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.pauseOnFocus}
                      onChange={(event) => onChange("pauseOnFocus", event.target.checked)}
                      disabled={disabled}
                    />
                  }
                  label="หยุดเมื่อโฟกัสด้วยแป้นพิมพ์"
                />
              </Stack>
            </Grid>
          </Grid>

          {!settings.showArrows && !settings.showDots && (
            <Alert severity="warning">
              ปุ่มลูกศรและจุดนำทางถูกปิดทั้งหมด ผู้ใช้ยังเปลี่ยนภาพได้ด้วยการปัดหรือแป้นพิมพ์
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
