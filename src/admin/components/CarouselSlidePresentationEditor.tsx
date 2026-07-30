import { useMemo, useState } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { designTokens } from "../../design-system/tokens";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import {
  DEFAULT_CAROUSEL_FOCAL_POINT,
  DEFAULT_CAROUSEL_IMAGE_FIT,
  normalizeCarouselFocalPoint
} from "../../features/cms-carousel";
import CarouselImageStage from "../../shared/components/CarouselImageStage";
import type { CarouselImageFit } from "../../features/cms-carousel/types";
import type { CarouselSlide } from "../../types";
import { CAROUSEL_FALLBACK_TITLE, isCarouselBackgroundColorValid } from "../utils/carousel";

export type CarouselMediaTarget = "desktop" | "mobile";

interface CarouselSlidePresentationFieldsProps {
  slide: CarouselSlide;
  disabled: boolean;
  onChange: <K extends keyof CarouselSlide>(key: K, value: CarouselSlide[K]) => void;
}

export function CarouselSlidePresentationFields({ slide, disabled, onChange }: CarouselSlidePresentationFieldsProps) {
  const backgroundColorValid = isCarouselBackgroundColorValid(slide.backgroundColor);

  function resetPresentation() {
    onChange("imageFit", DEFAULT_CAROUSEL_IMAGE_FIT);
    onChange("focalPointX", DEFAULT_CAROUSEL_FOCAL_POINT);
    onChange("focalPointY", DEFAULT_CAROUSEL_FOCAL_POINT);
    onChange("mobileImageUrl", "");
    onChange("backgroundColor", "");
    onChange("openInNewTab", false);
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              alignItems: { xs: "stretch", sm: "center" }
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 900
                }}
              >
                การแสดงผลรูปภาพ
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mt: 0.25
                }}
              >
                กำหนดการครอบภาพ จุดโฟกัส ภาพมือถือ และสีพื้นหลัง
              </Typography>
            </Box>
            <Button
              color="inherit"
              size="small"
              startIcon={<RestartAltOutlinedIcon />}
              disabled={disabled}
              onClick={resetPresentation}
            >
              คืนค่าการแสดงผล
            </Button>
          </Stack>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={disabled}>
                <InputLabel id="carousel-image-fit-label">การจัดวางภาพ</InputLabel>
                <Select
                  labelId="carousel-image-fit-label"
                  label="การจัดวางภาพ"
                  value={slide.imageFit}
                  onChange={(event) => onChange("imageFit", event.target.value as CarouselImageFit)}
                >
                  <MenuItem value="fill">เต็มพื้นที่ — อาจตัดขอบภาพ</MenuItem>
                  <MenuItem value="fit">เห็นภาพครบ — ใช้สีพื้นหลัง</MenuItem>
                  <MenuItem value="fit-blur">เห็นภาพครบ — พื้นหลังเบลอ</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="สีพื้นหลัง"
                value={slide.backgroundColor}
                onChange={(event) => onChange("backgroundColor", event.target.value)}
                placeholder={designTokens.color.brandPrimaryStrong}
                helperText={
                  backgroundColorValid
                    ? "รองรับรูปแบบ #RGB หรือ #RRGGBB และใช้กับโหมด Fit"
                    : "กรุณาระบุสีแบบ #RGB หรือ #RRGGBB"
                }
                error={!backgroundColorValid}
                disabled={disabled}
                fullWidth
                size="small"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="รูปภาพสำหรับมือถือ URL (ไม่บังคับ)"
                value={slide.mobileImageUrl}
                onChange={(event) => onChange("mobileImageUrl", event.target.value)}
                helperText="ใช้ภาพนี้เมื่อหน้าจอกว้างไม่เกิน 600 พิกเซล ถ้าเว้นว่างจะใช้ภาพหลัก"
                disabled={disabled}
                fullWidth
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="ตำแหน่งแนวนอน (%)"
                type="number"
                value={slide.focalPointX}
                onChange={(event) => onChange("focalPointX", normalizeCarouselFocalPoint(event.target.value))}
                helperText="0 = ซ้าย, 50 = กึ่งกลาง, 100 = ขวา"
                slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                disabled={disabled}
                fullWidth
                size="small"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="ตำแหน่งแนวตั้ง (%)"
                type="number"
                value={slide.focalPointY}
                onChange={(event) => onChange("focalPointY", normalizeCarouselFocalPoint(event.target.value))}
                helperText="0 = บน, 50 = กึ่งกลาง, 100 = ล่าง"
                slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                disabled={disabled}
                fullWidth
                size="small"
              />
            </Grid>
          </Grid>

          <FormControlLabel
            control={
              <Switch
                checked={slide.openInNewTab}
                onChange={(event) => onChange("openInNewTab", event.target.checked)}
                disabled={disabled}
              />
            }
            label="เปิดลิงก์ในแท็บใหม่"
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

interface CarouselSlidePresentationPreviewProps {
  slide: CarouselSlide;
}

export function CarouselSlidePresentationPreview({ slide }: CarouselSlidePresentationPreviewProps) {
  const [viewport, setViewport] = useState<CarouselMediaTarget>("desktop");

  const previewSlide = useMemo<CarouselSlide>(() => {
    if (viewport !== "mobile" || !slide.mobileImageUrl.trim()) {
      return slide;
    }

    return {
      ...slide,
      imageUrl: slide.mobileImageUrl,
      mobileImageUrl: ""
    };
  }, [slide, viewport]);

  const usingDesktopFallback = viewport === "mobile" && !slide.mobileImageUrl.trim();

  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          alignItems: { xs: "stretch", sm: "center" }
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 900
            }}
          >
            ตัวอย่างการแสดงผล
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary"
            }}
          >
            ใช้ renderer เดียวกับหน้าเว็บไซต์จริง
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={viewport}
          exclusive
          size="small"
          onChange={(_event, nextViewport: CarouselMediaTarget | null) => {
            if (nextViewport) {
              setViewport(nextViewport);
            }
          }}
          aria-label="ขนาดตัวอย่างสไลด์"
        >
          <ToggleButton value="desktop">เดสก์ท็อป</ToggleButton>
          <ToggleButton value="mobile">มือถือ</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {usingDesktopFallback && <Alert severity="info">ยังไม่ได้กำหนดภาพมือถือ ตัวอย่างนี้จึงใช้ภาพหลัก</Alert>}
      <Box
        sx={{
          width: "100%",
          maxWidth: viewport === "mobile" ? 360 : "100%",
          mx: "auto",
          borderRadius: designTokens.radius.medium,
          overflow: "hidden",
          boxShadow: designTokens.elevation.medium
        }}
      >
        <CarouselImageStage
          key={`${viewport}:${previewSlide.imageUrl}:${previewSlide.imageFit}:${previewSlide.focalPointX}:${previewSlide.focalPointY}:${previewSlide.backgroundColor}`}
          slide={previewSlide}
          alt={slide.imageAlt || slide.title || CAROUSEL_FALLBACK_TITLE}
          sizes={viewport === "mobile" ? "360px" : "(max-width: 900px) 100vw, 520px"}
          emptyLabel="ยังไม่มีรูปภาพ"
          stageSx={{
            height: viewport === "mobile" ? 420 : 280
          }}
        />
      </Box>
    </Stack>
  );
}
