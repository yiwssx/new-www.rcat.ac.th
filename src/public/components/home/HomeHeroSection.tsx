import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import PublicResponsiveImage from "../../../shared/media/PublicResponsiveImage";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { DirectorHeroCard } from "./DirectorHeroCard";
import { SiteSettings } from "../../../types";
import { designTokens } from "../../../design-system/tokens";

export function HomeHeroSection({ siteSettings }: { siteSettings: SiteSettings }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 1fr) minmax(240px, 280px)",
          lg: "minmax(0, 1fr) minmax(300px, 360px)"
        },
        gap: { xs: 2, md: 3 },
        alignItems: "stretch"
      }}
    >
      <Box
        component="section"
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 1,
          height: "100%",
          minHeight: { xs: 240, sm: 240, md: 240, lg: 240 },
          display: "flex",
          alignItems: "center",
          p: { xs: 2, sm: 2.5, md: 3.5 },
          color: "white",
          bgcolor: "primary.dark",
          boxShadow: designTokens.elevation.high
        }}
      >
        {siteSettings.heroImageUrl && (
          <PublicResponsiveImage
            source={siteSettings.heroImageUrl}
            intent="hero"
            alt=""
            loadMode="near-viewport"
            nearViewportMargin="240px 0px"
            sizes="(max-width: 900px) 100vw, 65vw"
            fill
            reservedMinHeight={240}
            imageSx={{ objectFit: "cover", objectPosition: "center" }}
            sx={{ position: "absolute", inset: 0, zIndex: 0 }}
          />
        )}

        <Box
          aria-hidden="true"
          sx={(theme) => ({
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background: `linear-gradient(120deg, ${alpha(theme.palette.primary.dark, 0.94)} 0%, ${alpha(
              theme.palette.primary.main,
              0.84
            )} 56%, ${alpha(theme.palette.secondary.dark, 0.58)} 100%)`
          })}
        />

        <Box
          sx={(theme) => ({
            position: "absolute",
            inset: 0,
            zIndex: 2,
            background: `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.04)} 0%, ${alpha(
              theme.palette.common.black,
              0.42
            )} 100%)`
          })}
        />

        <Box
          aria-hidden="true"
          sx={(theme) => ({
            display: { xs: "none", md: "block" },
            position: "absolute",
            zIndex: 2,
            right: 44,
            top: 34,
            width: 210,
            height: 210,
            borderRadius: "50%",
            bgcolor: alpha(theme.palette.common.white, 0.055),
            border: "1px solid",
            borderColor: alpha(theme.palette.common.white, 0.12)
          })}
        />

        <Box
          aria-hidden="true"
          sx={(theme) => ({
            display: { xs: "none", lg: "block" },
            position: "absolute",
            zIndex: 2,
            right: 108,
            bottom: -36,
            width: 150,
            height: 150,
            borderRadius: "50%",
            bgcolor: alpha(theme.palette.common.white, 0.045)
          })}
        />

        <Stack spacing={{ xs: 1.35, md: 1.6 }} sx={{ position: "relative", zIndex: 3, maxWidth: 620 }}>
          {siteSettings.heroChip && (
            <Chip
              icon={<SchoolOutlinedIcon />}
              label={siteSettings.heroChip}
              sx={(theme) => ({
                alignSelf: "flex-start",
                bgcolor: alpha(theme.palette.common.white, 0.14),
                color: "white",
                border: "1px solid",
                borderColor: alpha(theme.palette.common.white, 0.22),
                "& .MuiChip-icon": {
                  color: "secondary.main"
                }
              })}
            />
          )}

          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "1.75rem", sm: "2.1rem", md: "2.2rem", lg: "2.55rem" },
              fontWeight: 500,
              lineHeight: 1.08,
              letterSpacing: "-0.02em"
            }}
          >
            {siteSettings.heroTitle}
          </Typography>

          {siteSettings.heroDescription && (
            <Typography
              sx={(theme) => ({
                maxWidth: 520,
                color: alpha(theme.palette.common.white, 0.84),
                fontSize: { xs: "0.92rem", md: "1rem" },
                lineHeight: 1.55
              })}
            >
              {siteSettings.heroDescription}
            </Typography>
          )}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.2}
            sx={{
              alignItems: { xs: "stretch", sm: "center" }
            }}
          >
            {siteSettings.admissionUrl && (
              <Button
                variant="contained"
                color="error"
                size="medium"
                href={normalizeSafeHref(siteSettings.admissionUrl)}
                startIcon={<AssignmentOutlinedIcon />}
              >
                สมัครเรียน
              </Button>
            )}

            <Button
              variant="outlined"
              size="medium"
              href={normalizeSafeHref("/announcements")}
              sx={(theme) => ({
                color: "white",
                borderColor: alpha(theme.palette.common.white, 0.34)
              })}
            >
              ประกาศ
            </Button>

            <Button
              variant="text"
              size="medium"
              href={normalizeSafeHref("/news")}
              endIcon={<ArrowForwardOutlinedIcon />}
              sx={{ color: "white" }}
            >
              ข่าวสาร
            </Button>
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ width: "100%", height: "100%", display: "flex" }}>
        <DirectorHeroCard siteSettings={siteSettings} />
      </Box>
    </Box>
  );
}
